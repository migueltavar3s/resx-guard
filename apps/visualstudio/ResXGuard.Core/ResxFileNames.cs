using System;

namespace ResXGuard.Core;

public static class ResxFileNames
{
    public static bool IsResxFile(string? pathOrName)
    {
        if (string.IsNullOrWhiteSpace(pathOrName))
            return false;

        return pathOrName.EndsWith(".resx", StringComparison.OrdinalIgnoreCase);
    }
}
