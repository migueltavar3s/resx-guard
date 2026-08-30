using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Shell;
using Task = System.Threading.Tasks.Task;

namespace ResXGuard;

[PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
[Guid(PackageGuids.PackageString)]
[ProvideToolWindow(typeof(ResxGuardToolWindow), Style = VsDockStyle.Tabbed, Window = "DocumentWell")]
public sealed class ResXGuardPackage : AsyncPackage
{
    public static ResXGuardPackage? Instance { get; private set; }

    public ResourceIndexHost? IndexHost { get; private set; }

    protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
    {
        await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
        Instance = this;
        IndexHost = new ResourceIndexHost(this);
        await IndexHost.InitializeAsync(cancellationToken).ConfigureAwait(true);
        await ResxGuardToolWindow.InitializeAsync(this).ConfigureAwait(true);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
            IndexHost?.Dispose();
        base.Dispose(disposing);
    }
}
