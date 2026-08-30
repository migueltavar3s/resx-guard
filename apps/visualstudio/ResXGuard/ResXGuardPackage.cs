using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Task = System.Threading.Tasks.Task;

namespace ResXGuard;

[PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
[Guid(PackageGuids.PackageString)]
[ProvideMenuResource("Menus.ctmenu", 1)]
[ProvideAutoLoad("adfc4e64-0397-11d3-9f46-00c04f79df84", PackageAutoLoadFlags.BackgroundLoad)]
[ProvideAutoLoad("f1536ef2-3dad-431f-b9af-876417e5538f", PackageAutoLoadFlags.BackgroundLoad)]
[ProvideToolWindow(typeof(ResxGuardToolWindow), Style = VsDockStyle.Tabbed, Window = "DocumentWell")]
public sealed class ResXGuardPackage : AsyncPackage
{
    public static ResXGuardPackage? Instance { get; private set; }

    public ResourceIndexHost? IndexHost { get; private set; }

    protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
    {
        await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
        Instance = this;
        PackageLog.Write("Package initializing…");

        await ResXGuardCommands.InitializeAsync(this).ConfigureAwait(true);
        await ResxGuardToolWindow.InitializeAsync(this).ConfigureAwait(true);

        IndexHost = new ResourceIndexHost(this);
        try
        {
            await IndexHost.InitializeAsync(cancellationToken).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            PackageLog.Write("Index init failed: " + ex.Message);
        }

        PackageLog.Write("Package ready. Use Tools → ResX Guard or View → Other Windows → ResX Guard.");

        if (FindToolWindow(typeof(ResxGuardToolWindow), 0, false) is ResxGuardToolWindow openWindow)
            openWindow.PostSnapshot();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
            IndexHost?.Dispose();
        base.Dispose(disposing);
    }
}
