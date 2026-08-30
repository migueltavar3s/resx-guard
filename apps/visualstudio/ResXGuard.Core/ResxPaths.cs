using System;
using System.IO;

namespace ResXGuard.Core;

public static class ResxPaths
{
    public static string SatellitePath(string basePath, string locale)
    {
        if (string.IsNullOrEmpty(locale))
            return basePath;

        var dir = Path.GetDirectoryName(basePath) ?? "";
        var identity = Naming.ResolveResxIdentity(basePath);
        if (string.IsNullOrEmpty(identity.BaseName))
            return Path.Combine(dir, locale + ".resx");

        return Path.Combine(dir, identity.BaseName + "." + locale + ".resx");
    }

    public static bool IsExcludedPath(string filePath)
    {
        var normalized = filePath.Replace('\\', '/');
        return normalized.IndexOf("/bin/", StringComparison.OrdinalIgnoreCase) >= 0
            || normalized.IndexOf("/obj/", StringComparison.OrdinalIgnoreCase) >= 0
            || normalized.IndexOf("/node_modules/", StringComparison.OrdinalIgnoreCase) >= 0
            || normalized.IndexOf("/.git/", StringComparison.OrdinalIgnoreCase) >= 0;
    }
}
