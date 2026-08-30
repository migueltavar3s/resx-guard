using System;
using System.ComponentModel.Design;
using System.Threading;
using Microsoft.VisualStudio.Shell;
using Task = System.Threading.Tasks.Task;

namespace ResXGuard;

internal static class ResXGuardCommands
{
    public const int OpenToolWindowCommandId = 0x0100;
    public const int OpenFromResxCommandId = 0x0101;
    public const int OpenToolWindowToolsCommandId = 0x0102;
    public const int OpenFromResxXProjCommandId = 0x0103;

    public static async Task InitializeAsync(ResXGuardPackage package)
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

        if (await package.GetServiceAsync(typeof(IMenuCommandService)) is not IMenuCommandService commandService)
        {
            PackageLog.Write("Menu commands not registered (IMenuCommandService unavailable).");
            return;
        }

        PackageLog.Write("Registering menu commands.");

        var openWindow = new OleMenuCommand(
            (_, _) => _ = OpenToolWindowAsync(package),
            new CommandID(PackageGuids.CommandSet, OpenToolWindowCommandId));
        commandService.AddCommand(openWindow);

        var openWindowTools = new OleMenuCommand(
            (_, _) => _ = OpenToolWindowAsync(package),
            new CommandID(PackageGuids.CommandSet, OpenToolWindowToolsCommandId));
        commandService.AddCommand(openWindowTools);

        var openFromResx = new OleMenuCommand(
            (_, _) => _ = OpenFromResxAsync(package),
            BeforeQueryStatusOpenFromResx,
            new CommandID(PackageGuids.CommandSet, OpenFromResxCommandId));
        commandService.AddCommand(openFromResx);

        var openFromResxXProj = new OleMenuCommand(
            (_, _) => _ = OpenFromResxAsync(package),
            BeforeQueryStatusOpenFromResx,
            new CommandID(PackageGuids.CommandSet, OpenFromResxXProjCommandId));
        commandService.AddCommand(openFromResxXProj);
    }

    private static void BeforeQueryStatusOpenFromResx(object? sender, EventArgs e)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (sender is not OleMenuCommand command)
            return;

        var visible = VsResxSelection.TryGetSelectedResxPath(out _);
        command.Visible = visible;
        command.Enabled = visible;
    }

    public static async Task OpenToolWindowAsync(ResXGuardPackage package, CancellationToken cancellationToken = default)
    {
        await package.ShowToolWindowAsync(typeof(ResxGuardToolWindow), 0, create: true, cancellationToken).ConfigureAwait(true);
        (package.FindToolWindow(typeof(ResxGuardToolWindow), 0, false) as ResxGuardToolWindow)?.PostSnapshot();
    }

    private static async Task OpenFromResxAsync(ResXGuardPackage package)
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
        if (!VsResxSelection.TryGetSelectedResxPath(out _))
            return;

        await OpenToolWindowAsync(package).ConfigureAwait(true);
    }
}
