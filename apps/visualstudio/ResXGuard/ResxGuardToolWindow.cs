using System;
using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Imaging;
using Microsoft.VisualStudio.Shell;

namespace ResXGuard;

[Guid(PackageGuids.ToolWindowString)]
public class ResxGuardToolWindow : ToolWindowPane
{
    public ResxGuardToolWindow() : base(null)
    {
        Caption = "ResX Guard";
        BitmapImageMoniker = KnownMonikers.Table;
        Content = new ResxGuardControl();
    }

    public static async System.Threading.Tasks.Task InitializeAsync(ResXGuardPackage package)
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
    }

    public ResxGuardControl Control => (ResxGuardControl)Content;

    public void PostSnapshot()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        Control.PostSnapshot();
    }
}
