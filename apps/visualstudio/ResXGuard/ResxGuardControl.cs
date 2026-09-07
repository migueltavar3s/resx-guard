using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Controls;
using Microsoft.VisualStudio.Shell;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Newtonsoft.Json.Linq;
using ResXGuard.Core;

namespace ResXGuard;

public sealed class ResxGuardControl : UserControl
{
    private readonly WebView2 _webView = new();
    private WebViewBridge? _bridge;
    private ResourceIndexHost? _subscribedHost;
    private bool _ready;
    private int _snapshotAttempts;

    public ResxGuardControl()
    {
        Content = _webView;
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private void OnUnloaded(object sender, System.Windows.RoutedEventArgs e) => UnsubscribeFromHost();

    private void EnsureHostSubscription()
    {
        var host = ResXGuardPackage.Instance?.IndexHost;
        if (host == null || ReferenceEquals(host, _subscribedHost))
            return;

        UnsubscribeFromHost();
        _subscribedHost = host;
        host.Changed += OnIndexChanged;
    }

    private void UnsubscribeFromHost()
    {
        if (_subscribedHost == null)
            return;
        _subscribedHost.Changed -= OnIndexChanged;
        _subscribedHost = null;
    }

    private void OnIndexChanged(object? sender, EventArgs e)
    {
        _ = ThreadHelper.JoinableTaskFactory.RunAsync(async () =>
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
            PostSnapshot();
        });
    }

    private async void OnLoaded(object sender, System.Windows.RoutedEventArgs e)
    {
        try
        {
            var webViewDir = Path.Combine(Path.GetDirectoryName(typeof(ResxGuardControl).Assembly.Location)!, "WebView", "dist");
            if (!Directory.Exists(webViewDir))
            {
                Content = new TextBlock
                {
                    Text = "ResX Guard UI not found. Run: node scripts/build-ui.mjs",
                    TextWrapping = System.Windows.TextWrapping.Wrap,
                    Margin = new System.Windows.Thickness(12)
                };
                return;
            }

            _webView.CreationProperties = new CoreWebView2CreationProperties
            {
                UserDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ResXGuard", "WebView2")
            };
            await _webView.EnsureCoreWebView2Async().ConfigureAwait(true);

            await _webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(
                WebViewThemeInjector.GetDocumentCreatedScript()).ConfigureAwait(true);

            var settings = _webView.CoreWebView2.Settings;
            settings.IsWebMessageEnabled = true;
            settings.AreDevToolsEnabled = false;

            _webView.CoreWebView2.SetVirtualHostNameToFolderMapping("resxguard.local", webViewDir, CoreWebView2HostResourceAccessKind.Allow);
            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
            _webView.CoreWebView2.NavigationCompleted += (_, _) => SchedulePostSnapshot();
            _webView.Source = new Uri("https://resxguard.local/index.html");
        }
        catch (Exception ex)
        {
            Content = new TextBlock { Text = "Failed to load ResX Guard UI: " + ex.Message, TextWrapping = System.Windows.TextWrapping.Wrap };
        }
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        try
        {
            var json = TryReadWebMessageJson(e);
            if (json == null)
                return;

            var msg = HostJson.ParseWebMessage(json);
            var type = msg["type"]?.ToString();
            if (type == "ready")
            {
                _ready = true;
                EnsureHostSubscription();
                SchedulePostSnapshot();
                return;
            }

            EnsureHostSubscription();
            var host = ResXGuardPackage.Instance?.IndexHost;
            if (host == null)
                return;

            _bridge ??= new WebViewBridge(_webView);
            _ = host.HandleMessageAsync(msg, _bridge);
        }
        catch (Exception ex)
        {
            PackageLog.Write("WebView message error: " + ex.Message);
        }
    }

    private static string? TryReadWebMessageJson(CoreWebView2WebMessageReceivedEventArgs e)
    {
        string? jsonPayload = null;
        try
        {
            jsonPayload = e.WebMessageAsJson;
        }
        catch (ArgumentException)
        {
            // WebMessageAsJson throws when the page posted a plain string.
        }

        string? plainText = null;
        try
        {
            plainText = e.TryGetWebMessageAsString();
        }
        catch (ArgumentException)
        {
            // TryGetWebMessageAsString throws when the page posted an object.
        }

        return HostJson.NormalizeIncomingWebMessage(jsonPayload, plainText);
    }

    private void SchedulePostSnapshot()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        _ = ThreadHelper.JoinableTaskFactory.RunAsync(async () =>
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
            await TryPostSnapshotAsync().ConfigureAwait(true);
        });
    }

    private async Task TryPostSnapshotAsync()
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

        if (!_ready || _webView.CoreWebView2 == null)
            return;

        var host = ResXGuardPackage.Instance?.IndexHost;
        if (host == null)
        {
            EnsureHostSubscription();
            if (_snapshotAttempts++ < 40)
            {
                await Task.Delay(250).ConfigureAwait(true);
                await TryPostSnapshotAsync().ConfigureAwait(true);
            }
            else
            {
                PackageLog.Write("Index host not ready; snapshot not sent.");
            }
            return;
        }

        EnsureHostSubscription();
        _snapshotAttempts = 0;
        PostSnapshot();
    }

    public void PostSnapshot()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (!_ready || _webView.CoreWebView2 == null)
            return;

        var host = ResXGuardPackage.Instance?.IndexHost;
        if (host == null)
            return;

        try
        {
            _bridge ??= new WebViewBridge(_webView);
            var snapshot = host.GetSnapshot("en");
            _bridge.Post(new { type = "snapshot", payload = snapshot });
        }
        catch (Exception ex)
        {
            PackageLog.Write("PostSnapshot failed: " + ex.Message);
        }
    }
}

public sealed class WebViewBridge
{
    private readonly WebView2 _webView;

    public WebViewBridge(WebView2 webView) => _webView = webView;

    public void Post(object message)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        _webView.CoreWebView2?.PostWebMessageAsJson(HostJson.Serialize(message));
    }
}
