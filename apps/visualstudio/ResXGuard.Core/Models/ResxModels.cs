namespace ResXGuard.Core;

public static class ResxConstants
{
    public const string NeutralLocale = "";
}

public enum IssueSeverity { Warning, Error, Hint, Info }

public enum IssueRule
{
    KeyPascalCase,
    MatchingSuffix,
    Placeholders,
    MissingTranslation,
    DuplicateKeys
}

public sealed class ValidationIssue
{
    public IssueRule Rule { get; init; }
    public IssueSeverity Severity { get; init; }
    public string Message { get; init; } = "";
    public string? Locale { get; init; }
    public string Key { get; init; } = "";
    public string FamilyId { get; init; } = "";
    public string? SuggestedKey { get; init; }
}

public sealed class ResxEntry
{
    public string Key { get; init; } = "";
    public string Value { get; init; } = "";
    public string Comment { get; init; } = "";
}

public sealed class ResxFile
{
    public string Path { get; init; } = "";
    public string Locale { get; init; } = "";
    public List<ResxEntry> Entries { get; init; } = new();
    public List<string> DuplicateKeys { get; init; } = new();
}

public sealed class ResxFamily
{
    public string Id { get; init; } = "";
    public string BasePath { get; init; } = "";
    public string DisplayName { get; init; } = "";
    public string ProjectName { get; init; } = "";
    public Dictionary<string, string> Files { get; init; } = new();
}

public sealed class ResourceRow
{
    public string FamilyId { get; init; } = "";
    public string Key { get; init; } = "";
    public string Comment { get; init; } = "";
    public Dictionary<string, string> Values { get; init; } = new();
    public List<ValidationIssue> Issues { get; init; } = new();
}

public sealed class ValidationRulesConfig
{
    public bool KeyPascalCase { get; init; } = true;
    public bool MatchingSuffix { get; init; } = true;
    public bool Placeholders { get; init; } = true;
    public bool MissingTranslation { get; init; } = true;
    public bool DuplicateKeys { get; init; } = true;
}

public sealed class ExtensionSettings
{
    public string NeutralLocale { get; init; } = "";
    public string KeyNaming { get; init; } = "pascalFromNeutral";
    public bool UpdateDesignerCs { get; init; } = true;
    public List<string> VisibleLocales { get; init; } = new();
    public ValidationRulesConfig Rules { get; init; } = new();
}

public sealed class TreeNode
{
    public string Id { get; init; } = "";
    public string Label { get; init; } = "";
    public string Kind { get; init; } = "";
    public List<TreeNode>? Children { get; init; }
    public string? FamilyId { get; init; }
    public bool? Checked { get; init; }
}

public sealed class IndexSnapshot
{
    public List<ResxFamily> Families { get; init; } = new();
    public List<ResourceRow> Rows { get; init; } = new();
    public List<string> Locales { get; init; } = new();
    public List<TreeNode> Tree { get; init; } = new();
    public List<string> SelectedFamilyIds { get; init; } = new();
    public List<string> VisibleLocales { get; init; } = new();
    public ExtensionSettings Settings { get; init; } = new();
    public string Language { get; init; } = "en";
    public string Version { get; init; } = "";
}

public sealed class WorkspaceFolder
{
    public string Name { get; init; } = "";
    public string FsPath { get; init; } = "";
}

public sealed class ScannedWorkspace
{
    public List<ResxFamily> Families { get; init; } = new();
    public List<TreeNode> Tree { get; init; } = new();
}
