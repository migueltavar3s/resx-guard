using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using ResXGuard.Core;

namespace ResXGuard;

internal sealed class SourceFileWatcher : IDisposable
{
    private readonly Action<string> _onChanged;
    private readonly Action<string> _onDeleted;
    private readonly List<FileSystemWatcher> _watchers = new();
    private readonly object _gate = new();

    public SourceFileWatcher(Action<string> onChanged, Action<string> onDeleted)
    {
        _onChanged = onChanged;
        _onDeleted = onDeleted;
    }

    public void UpdateWatchRoots(IEnumerable<string> directories)
    {
        lock (_gate)
        {
            DisposeWatchers();
            foreach (var dir in directories.Where(Directory.Exists).Distinct(StringComparer.OrdinalIgnoreCase))
            {
                try
                {
                    var watcher = new FileSystemWatcher(dir, "*.*")
                    {
                        IncludeSubdirectories = true,
                        NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.CreationTime,
                        EnableRaisingEvents = true,
                    };
                    watcher.Changed += OnChanged;
                    watcher.Created += OnChanged;
                    watcher.Deleted += OnDeleted;
                    watcher.Renamed += OnRenamed;
                    _watchers.Add(watcher);
                }
                catch
                {
                    // Skip unreadable roots.
                }
            }
        }
    }

    private void OnChanged(object sender, FileSystemEventArgs e)
    {
        if (!UsagePaths.IsUsageSourcePath(e.FullPath))
            return;
        _onChanged(e.FullPath);
    }

    private void OnDeleted(object sender, FileSystemEventArgs e)
    {
        if (!UsagePaths.IsUsageSourcePath(e.FullPath))
            return;
        _onDeleted(e.FullPath);
    }

    private void OnRenamed(object sender, RenamedEventArgs e)
    {
        if (UsagePaths.IsUsageSourcePath(e.OldFullPath))
            _onDeleted(e.OldFullPath);
        if (UsagePaths.IsUsageSourcePath(e.FullPath))
            _onChanged(e.FullPath);
    }

    public void Dispose()
    {
        lock (_gate)
            DisposeWatchers();
    }

    private void DisposeWatchers()
    {
        foreach (var watcher in _watchers)
        {
            watcher.EnableRaisingEvents = false;
            watcher.Dispose();
        }
        _watchers.Clear();
    }
}
