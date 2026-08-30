using System.Text;

namespace ResXGuard;

/// <summary>
/// Injects VS Code-compatible CSS variables into WebView2 (Visual Studio does not provide them automatically).
/// </summary>
internal static class WebViewThemeInjector
{
    public static string GetDocumentCreatedScript(bool preferLight = false)
    {
        var vars = preferLight ? LightTheme : DarkTheme;
        var css = vars.Replace("'", "\\'");
        var sb = new StringBuilder();
        sb.Append("(function(){var s=document.createElement('style');");
        sb.Append("s.id='resxguard-theme';s.textContent='");
        sb.Append(css);
        sb.Append("';document.documentElement.appendChild(s);})();");
        return sb.ToString();
    }

    private const string DarkTheme = @":root {
  --vscode-font-family: 'Segoe UI', system-ui, sans-serif;
  --vscode-font-size: 13px;
  --vscode-foreground: #cccccc;
  --vscode-descriptionForeground: #9d9d9d;
  --vscode-editor-background: #1e1e1e;
  --vscode-sideBar-background: #252526;
  --vscode-panel-border: #3c3c3c;
  --vscode-input-background: #3c3c3c;
  --vscode-input-foreground: #cccccc;
  --vscode-input-border: #3c3c3c;
  --vscode-dropdown-background: #3c3c3c;
  --vscode-dropdown-foreground: #cccccc;
  --vscode-dropdown-border: #3c3c3c;
  --vscode-editorWidget-background: #252526;
  --vscode-widget-border: #454545;
  --vscode-list-hoverBackground: rgba(128,128,128,0.15);
  --vscode-list-activeSelectionBackground: rgba(0,127,212,0.35);
  --vscode-list-activeSelectionForeground: #ffffff;
  --vscode-focusBorder: #007fd4;
  --vscode-toolbar-hoverBackground: rgba(128,128,128,0.15);
  --vscode-errorForeground: #f14c4c;
  --vscode-textLink-foreground: #3794ff;
  color-scheme: dark;
}";

    private const string LightTheme = @":root {
  --vscode-font-family: 'Segoe UI', system-ui, sans-serif;
  --vscode-font-size: 13px;
  --vscode-foreground: #333333;
  --vscode-descriptionForeground: #717171;
  --vscode-editor-background: #ffffff;
  --vscode-sideBar-background: #f3f3f3;
  --vscode-panel-border: #e5e5e5;
  --vscode-input-background: #ffffff;
  --vscode-input-foreground: #333333;
  --vscode-input-border: #cecece;
  --vscode-dropdown-background: #ffffff;
  --vscode-dropdown-foreground: #333333;
  --vscode-dropdown-border: #cecece;
  --vscode-editorWidget-background: #f3f3f3;
  --vscode-widget-border: #c8c8c8;
  --vscode-list-hoverBackground: rgba(0,0,0,0.06);
  --vscode-list-activeSelectionBackground: rgba(0,120,212,0.2);
  --vscode-list-activeSelectionForeground: #000000;
  --vscode-focusBorder: #0078d4;
  --vscode-toolbar-hoverBackground: rgba(0,0,0,0.06);
  --vscode-errorForeground: #a1260d;
  --vscode-textLink-foreground: #006ab1;
  color-scheme: light;
}";
}
