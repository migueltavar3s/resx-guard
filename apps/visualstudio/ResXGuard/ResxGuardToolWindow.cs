using System;
using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Shell;

namespace ResXGuard;

[Guid(PackageGuids.ToolWindowString)]
public class ResxGuardToolWindow : ToolWindowPane
{
    public ResxGuardToolWindow() : base(null)
    {
        Caption = "ResX Guard";
        Content = new ResxGuardControl();
    }

    public static async System.Threading.Tasks.Task InitializeAsync(ResXGuardPackage package)
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
        // Tool window registered via ProvideToolWindow attribute.
    }

    public ResxGuardControl Control => (ResxGuardControl)Content;

    public void PostSnapshot()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        Control.PostSnapshot();
    }
}
