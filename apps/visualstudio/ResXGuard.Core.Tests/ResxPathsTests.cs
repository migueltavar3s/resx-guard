using ResXGuard.Core;
using Xunit;

namespace ResXGuard.Core.Tests;

public sealed class ResxPathsTests
{
    [Fact]
    public void SatellitePath_appends_locale_to_base_name()
    {
        var path = ResxPaths.SatellitePath(@"C:\proj\Resources.resx", "pt");
        Assert.Equal(@"C:\proj\Resources.pt.resx", path);
    }

    [Fact]
    public void IsExcludedPath_skips_bin_and_obj()
    {
        Assert.True(ResxPaths.IsExcludedPath(@"C:\proj\bin\Debug\Resources.resx"));
        Assert.True(ResxPaths.IsExcludedPath(@"C:\proj\obj\Debug\Resources.resx"));
        Assert.False(ResxPaths.IsExcludedPath(@"C:\proj\Resources.resx"));
    }
}
