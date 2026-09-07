using System.Text;
using ResXGuard.Core;
using Xunit;

namespace ResXGuard.Core.Tests;

public sealed class ResxTextTests
{
    private const string Sample = """
        <?xml version="1.0" encoding="utf-8"?>
        <root>
          <xsd:schema id="root" xmlns="" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
            <xsd:element name="data" />
          </xsd:schema>
          <data name="Hello" xml:space="preserve">
            <value>Hello world</value>
            <comment>greeting</comment>
          </data>
          <data name="Bye" xml:space="preserve">
            <value>Goodbye</value>
          </data>
        </root>
        """;

    [Fact]
    public void Rename_only_changes_the_name_attribute()
    {
        var next = ResxText.RenameResxKeyInXml(Sample, "Hello", "HelloWorld");
        Assert.Contains("name=\"HelloWorld\"", next);
        Assert.StartsWith("<?xml version=\"1.0\" encoding=\"utf-8\"?>", next);
        Assert.True(next.IndexOf("name=\"Bye\"", StringComparison.Ordinal) < next.IndexOf("name=\"HelloWorld\"", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Rename_preserves_utf8_bom_and_crlf()
    {
        var dir = Path.Combine(Path.GetTempPath(), "resx-guard-" + Guid.NewGuid().ToString("n"));
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, "Resources.resx");
        var original = Sample.Replace("\n", "\r\n");
        var bom = new UTF8Encoding(true);
        File.WriteAllText(path, original, bom);

        await ResxParser.RenameResxKeyAsync(path, "Hello", "HelloWorld");

        var bytes = File.ReadAllBytes(path);
        Assert.Equal(0xef, bytes[0]);
        Assert.Equal(0xbb, bytes[1]);
        Assert.Equal(0xbf, bytes[2]);
        var text = Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);
        Assert.Contains("\r\n", text);
        Assert.DoesNotContain("\n", text.Replace("\r\n", ""));
        Assert.Contains("name=\"HelloWorld\"", text);
        Assert.True(text.IndexOf("name=\"Bye\"", StringComparison.Ordinal) < text.IndexOf("name=\"HelloWorld\"", StringComparison.Ordinal));
    }

    [Fact]
    public void Add_and_rename_keep_data_entries_alphabetical()
    {
        var withAlpha = ResxText.AddResxEntryInXml(Sample, "Alpha", "A");
        Assert.True(withAlpha.IndexOf("name=\"Alpha\"", StringComparison.Ordinal) < withAlpha.IndexOf("name=\"Bye\"", StringComparison.Ordinal));
        Assert.True(withAlpha.IndexOf("name=\"Bye\"", StringComparison.Ordinal) < withAlpha.IndexOf("name=\"Hello\"", StringComparison.Ordinal));

        var renamed = ResxText.RenameResxKeyInXml(withAlpha, "Alpha", "Zulu");
        Assert.True(renamed.IndexOf("name=\"Bye\"", StringComparison.Ordinal) < renamed.IndexOf("name=\"Hello\"", StringComparison.Ordinal));
        Assert.True(renamed.IndexOf("name=\"Hello\"", StringComparison.Ordinal) < renamed.IndexOf("name=\"Zulu\"", StringComparison.Ordinal));
    }
}

public sealed class UsageIndexTests
{
    [Fact]
    public void Word_boundary_matches_cshtml_and_js_but_not_prefix_keys()
    {
        Assert.Equal(1, UsageMatcher.CountKey("@Localizer[\"SaveFailed\"]", "SaveFailed"));
        Assert.Equal(0, UsageMatcher.CountKey("Resources.SaveFailed()", "Save"));
        Assert.True(UsageMatcher.CountKey("class Name { } var Name = 1;", "Name") > 1);
    }

    [Fact]
    public void Index_updates_one_file_without_touching_the_other()
    {
        var index = new UsageIndex();
        index.IndexFile("/proj/Home.cshtml", "@Localizer[\"Welcome\"] @Localizer[\"Welcome\"]");
        index.IndexFile("/proj/app.js", "t('Welcome'); t('Bye')");
        Assert.Equal(3, index.Count("Welcome"));
        index.IndexFile("/proj/app.js", "t('Bye')");
        Assert.Equal(2, index.Count("Welcome"));
        Assert.Equal(1, index.Count("Bye"));
    }
}
