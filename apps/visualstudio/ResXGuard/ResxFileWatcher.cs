using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using ResXGuard.Core;

namespace ResXGuard;

internal sealed class ResxFileWatcher : IDisposable
{
    private readonly Action _onResxChanged;
    private readonly List<FileSystemWatcher> _watchers = new();
    private readonly object _gate = new();

    public ResxFileWatcher(Action onResxChanged) => _onResxChanged = onResxChanged;

    public void UpdateWatchRoots(IEnumerable<string> directories)
    {
        lock (_gate)
        {
            DisposeWatchers();
            foreach (var dir in directories.Where(Directory.Exists).Distinct(StringComparer.OrdinalIgnoreCase))
            {
                try
                {
                    var watcher = new FileSystemWatcher(dir, "*.resx")
                    {
                        IncludeSubdirectories = true,
                        NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.CreationTime,
                        EnableRaisingEvents = true,
                    };
                    watcher.Changed += OnFsEvent;
                    watcher.Created += OnFsEvent;
                    watcher.Deleted += OnFsEvent;
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

    private void OnFsEvent(object sender, FileSystemEventArgs e)
    {
        if (ResxPaths.IsExcludedPath(e.FullPath))
            return;
        _onResxChanged();
    }

    private void OnRenamed(object sender, RenamedEventArgs e)
    {
        if (ResxPaths.IsExcludedPath(e.FullPath) && ResxPaths.IsExcludedPath(e.OldFullPath))
            return;
        _onResxChanged();
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
