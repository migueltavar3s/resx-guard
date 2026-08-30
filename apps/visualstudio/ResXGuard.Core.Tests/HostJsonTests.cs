using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using ResXGuard.Core;
using Xunit;

namespace ResXGuard.Core.Tests;

public sealed class HostJsonTests
{
    [Fact]
    public void SerializeSnapshot_uses_camelCase_payload()
    {
        var snapshot = new IndexSnapshot
        {
            Families = new List<ResxFamily>
            {
                new()
                {
                    Id = "family-1",
                    DisplayName = "Resources",
                    BasePath = @"C:\proj\Resources.resx",
                    ProjectName = "SampleProject",
                    Files = new Dictionary<string, string> { { string.Empty, @"C:\proj\Resources.resx" } }
                }
            },
            Rows = new List<ResourceRow>
            {
                new()
                {
                    FamilyId = "family-1",
                    Key = "Hello",
                    Values = new Dictionary<string, string> { { string.Empty, "Hello" } }
                }
            },
            Locales = new List<string> { string.Empty },
            SelectedFamilyIds = new List<string> { "family-1" },
            VisibleLocales = new List<string> { string.Empty },
            Version = "0.2.0"
        };

        var json = HostJson.SerializeSnapshot(snapshot);
        var root = JObject.Parse(json);

        Assert.Equal("snapshot", root["type"]?.ToString());
        Assert.NotNull(root["payload"]?["families"]);
        Assert.NotNull(root["payload"]?["rows"]);
        Assert.Equal("0.2.0", root["payload"]?["version"]?.ToString());
        Assert.Null(root["payload"]?["Families"]);
    }

    [Fact]
    public void NormalizeIncomingWebMessage_wraps_plain_string_as_type()
    {
        var json = HostJson.NormalizeIncomingWebMessage(null, "ready");
        Assert.NotNull(json);
        var msg = HostJson.ParseWebMessage(json!);
        Assert.Equal("ready", msg["type"]?.ToString());
    }

    [Fact]
    public void NormalizeIncomingWebMessage_prefers_json_payload()
    {
        var json = HostJson.NormalizeIncomingWebMessage("{\"type\":\"ready\"}", "ignored");
        Assert.Equal("{\"type\":\"ready\"}", json);
    }
}
