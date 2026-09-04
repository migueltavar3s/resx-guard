using System.Collections.Generic;
using ResXGuard.Core;
using Xunit;

namespace ResXGuard.Core.Tests;

public sealed class ValidationEngineTests
{
    [Fact]
    public void KeyPascalCase_includes_suggested_key()
    {
        var family = new ResxFamily
        {
            Id = "f1",
            BasePath = "/p/Resources.resx",
            DisplayName = "Resources",
            ProjectName = "Sample",
            Files = new Dictionary<string, string> { [""] = "/p/Resources.resx" }
        };
        var files = new List<ResxFile>
        {
            new()
            {
                Path = "/p/Resources.resx",
                Locale = "",
                Entries = new List<ResxEntry> { new() { Key = "WrongKey", Value = "Save failed." } }
            }
        };

        var issues = ValidationEngine.ValidateFamily(family, files, new ValidationRulesConfig());
        var naming = Assert.Single(issues, i => i.Rule == IssueRule.KeyPascalCase);

        Assert.Equal(IssueSeverity.Warning, naming.Severity);
        Assert.Equal("SaveFailed", naming.SuggestedKey);
    }

    [Fact]
    public void Manual_key_naming_skips_pascal_case()
    {
        var family = new ResxFamily
        {
            Id = "f1",
            BasePath = "/p/Resources.resx",
            DisplayName = "Resources",
            ProjectName = "Sample",
            Files = new Dictionary<string, string> { [""] = "/p/Resources.resx" }
        };
        var files = new List<ResxFile>
        {
            new()
            {
                Path = "/p/Resources.resx",
                Locale = "",
                Entries = new List<ResxEntry> { new() { Key = "WrongKey", Value = "Save failed." } }
            }
        };

        var rules = ValidationEngine.EffectiveRules(new ValidationRulesConfig(), "manual");
        var issues = ValidationEngine.ValidateFamily(family, files, rules);

        Assert.DoesNotContain(issues, i => i.Rule == IssueRule.KeyPascalCase);
    }

    [Fact]
    public void DuplicateKeys_are_errors()
    {
        var family = new ResxFamily
        {
            Id = "f1",
            BasePath = "/p/Resources.resx",
            DisplayName = "Resources",
            ProjectName = "Sample",
            Files = new Dictionary<string, string> { [""] = "/p/Resources.resx" }
        };
        var files = new List<ResxFile>
        {
            new()
            {
                Path = "/p/Resources.resx",
                Locale = "",
                DuplicateKeys = new List<string> { "Hello" },
                Entries = new List<ResxEntry> { new() { Key = "Hello", Value = "Hello" } }
            }
        };

        var issues = ValidationEngine.ValidateFamily(family, files, new ValidationRulesConfig());
        var duplicate = Assert.Single(issues, i => i.Rule == IssueRule.DuplicateKeys);
        Assert.Equal(IssueSeverity.Error, duplicate.Severity);
        Assert.Null(duplicate.SuggestedKey);
    }
}
