using ResXGuard.Core;
using Xunit;

namespace ResXGuard.Core.Tests;

public sealed class ResxFileNamesTests
{
    [Theory]
    [InlineData("Resources.resx", true)]
    [InlineData("Resources.pt.resx", true)]
    [InlineData("Resources.resx.cs", false)]
    [InlineData(null, false)]
    public void IsResxFile_matches_extension(string? input, bool expected)
    {
        Assert.Equal(expected, ResxFileNames.IsResxFile(input));
    }
}
