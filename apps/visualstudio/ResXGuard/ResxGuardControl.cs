using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Controls;
using Microsoft.VisualStudio.Shell;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using ResXGuard.Core;

namespace ResXGuard;

public sealed class ResxGuardControl : UserControl
{
    private readonly WebView2 _webView = new();
    private WebViewBridge? _bridge;
    private bool _ready;

    public ResxGuardControl()
    {
        Content = _webView;
        Loaded += OnLoaded;
    }

    private async void OnLoaded(object sender, System.Windows.RoutedEventArgs e)
    {
        try
        {
            var webViewDir = Path.Combine(Path.GetDirectoryName(typeof(ResxGuardControl).Assembly.Location)!, "WebView", "dist");
            _webView.CreationProperties = new CoreWebView2CreationProperties
            {
                UserDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ResXGuard", "WebView2")
            };
            await _webView.EnsureCoreWebView2Async().ConfigureAwait(true);
            _webView.CoreWebView2.SetVirtualHostNameToFolderMapping("resxguard.local", webViewDir, CoreWebView2HostResourceAccessKind.Allow);
            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
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
            var msg = JObject.Parse(e.WebMessageAsJson);
            var type = msg["type"]?.ToString();
            if (type == "ready")
            {
                _ready = true;
                PostSnapshot();
                return;
            }
            var host = ResXGuardPackage.Instance?.IndexHost;
            if (host == null) return;
            _bridge ??= new WebViewBridge(_webView);
            _ = host.HandleMessageAsync(msg, _bridge);
        }
        catch { /* ignore malformed messages */ }
    }

    public void PostSnapshot()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (!_ready || _webView.CoreWebView2 == null) return;
        var host = ResXGuardPackage.Instance?.IndexHost;
        if (host == null) return;
        _bridge ??= new WebViewBridge(_webView);
        var snapshot = host.GetSnapshot(ThreadHelper.CheckAccess() ? "en" : "en");
        _bridge.Post(new { type = "snapshot", payload = snapshot });
    }
}

public sealed class WebViewBridge
{
    private readonly WebView2 _webView;

    public WebViewBridge(WebView2 webView) => _webView = webView;

    public void Post(object message)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        _webView.CoreWebView2?.PostWebMessageAsJson(JsonConvert.SerializeObject(message));
    }
}
