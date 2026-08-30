using System.IO;
using System.Xml.Linq;
using Xunit;

namespace ResXGuard.Core.Tests;

public sealed class VsctManifestTests
{
    [Fact]
    public void Vsct_declares_open_with_resx_in_item_open_group()
    {
        var vsctPath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..",
            "ResXGuard", "ResXGuard.vsct"));

        Assert.True(File.Exists(vsctPath), "VSCT file not found: " + vsctPath);

        var doc = XDocument.Load(vsctPath);
        XNamespace ns = doc.Root!.Name.Namespace;

        var openGroup = doc.Descendants(ns + "Group")
            .FirstOrDefault(g => (string?)g.Element(ns + "Parent")?.Attribute("id") == "IDM_VS_CTXT_ITEMNODE"
                && (string?)g.Attribute("id") == "ResXGuardOpenGroup");
        Assert.NotNull(openGroup);

        var buttonText = doc.Descendants(ns + "Button")
            .Where(b => (string?)b.Element(ns + "Parent")?.Attribute("id") == "ResXGuardOpenGroup")
            .Select(b => b.Descendants(ns + "ButtonText").FirstOrDefault()?.Value)
            .FirstOrDefault();

        Assert.Equal("Open with ResX Guard", buttonText);
    }
}
