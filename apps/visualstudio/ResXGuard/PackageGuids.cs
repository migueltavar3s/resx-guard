using System;

namespace ResXGuard;

public static class PackageGuids
{
    public const string PackageString = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    public const string ToolWindowString = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
    public const string CommandSetString = "c3d4e5f6-a7b8-9012-cdef-123456789012";

    public static readonly Guid Package = new(PackageString);
    public static readonly Guid CommandSet = new(CommandSetString);
}
