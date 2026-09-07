using System;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;

namespace ResXGuard;

internal static class PackageLog
{
    private static IVsOutputWindowPane? _pane;

    public static void Write(string message)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        _pane ??= TryGetPane();
        _pane?.OutputStringThreadSafe($"[ResX Guard] {message}{Environment.NewLine}");
    }

    private static IVsOutputWindowPane? TryGetPane()
    {
        if (Package.GetGlobalService(typeof(SVsOutputWindow)) is not IVsOutputWindow outputWindow)
            return null;

        var guid = new Guid("e7967bcd-1f99-489b-9b44-536634a3f055"); // General output pane
        return outputWindow.CreatePane(ref guid, "ResX Guard", 1, 1) == 0
            && outputWindow.GetPane(ref guid, out var pane) == 0
            ? pane
            : null;
    }
}
