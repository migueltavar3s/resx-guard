using System.Text;
using System.Text.RegularExpressions;

namespace ResXGuard.Core;

public static class UsagePaths
{
    public static readonly string[] SourceExtensions =
    {
        ".cs", ".cshtml", ".razor", ".vb", ".js", ".jsx", ".ts", ".tsx",
        ".html", ".aspx", ".ascx", ".master", ".vue"
    };

    public static bool IsExcluded(string filePath)
    {
        var normalized = filePath.Replace('\\', '/');
        if (ResxPaths.IsExcludedPath(normalized)) return true;
        if (normalized.IndexOf("/.vs/", StringComparison.OrdinalIgnoreCase) >= 0) return true;
        if (normalized.EndsWith(".resx", StringComparison.OrdinalIgnoreCase)) return true;
        if (normalized.EndsWith(".Designer.cs", StringComparison.OrdinalIgnoreCase)) return true;
        if (normalized.EndsWith(".min.js", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    public static bool IsUsageSourcePath(string filePath)
    {
        if (IsExcluded(filePath)) return false;
        var ext = Path.GetExtension(filePath);
        return SourceExtensions.Any(e => string.Equals(e, ext, StringComparison.OrdinalIgnoreCase));
    }
}

/// <summary>
/// Mode-based key matcher. Default is <c>\bKey\b</c>; add a stricter mode later without changing the index.
/// </summary>
public static class UsageMatcher
{
    public const string WordBoundary = "wordBoundary";

    private static readonly Regex IdentifierToken = new(@"\b[A-Za-z_][A-Za-z0-9_]*\b", RegexOptions.Compiled);
    private static readonly Regex IdentifierKey = new(@"^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);

    public static string WordBoundaryPattern(string key) =>
        @"\b" + Regex.Escape(key) + @"\b";

    public static int CountKey(string text, string key, string mode = WordBoundary)
    {
        if (string.IsNullOrEmpty(key)) return 0;
        if (mode != WordBoundary)
            throw new ArgumentOutOfRangeException(nameof(mode), mode, "Unknown usage match mode.");
        return Regex.Matches(text, WordBoundaryPattern(key)).Count;
    }

    public static Dictionary<string, int> ExtractCounts(string text, string mode = WordBoundary)
    {
        if (mode != WordBoundary)
            throw new ArgumentOutOfRangeException(nameof(mode), mode, "Unknown usage match mode.");
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (Match match in IdentifierToken.Matches(text))
        {
            counts.TryGetValue(match.Value, out var n);
            counts[match.Value] = n + 1;
        }
        return counts;
    }

    public static bool IsIdentifierKey(string key) => IdentifierKey.IsMatch(key);
}

public sealed class UsageIndex
{
    private readonly Dictionary<string, Dictionary<string, int>> _perFile = new(StringComparer.OrdinalIgnoreCase);
    private readonly string _mode;

    public UsageIndex(string mode = UsageMatcher.WordBoundary) => _mode = mode;

    public string Mode => _mode;

    public int IndexedFileCount
    {
        get { lock (_perFile) return _perFile.Count; }
    }

    public void IndexFile(string filePath, string text)
    {
        if (!UsagePaths.IsUsageSourcePath(filePath))
        {
            RemoveFile(filePath);
            return;
        }
        var counts = UsageMatcher.ExtractCounts(text, _mode);
        lock (_perFile)
            _perFile[Normalize(filePath)] = counts;
    }

    public void RemoveFile(string filePath)
    {
        lock (_perFile)
            _perFile.Remove(Normalize(filePath));
    }

    public int Count(string key)
    {
        if (string.IsNullOrEmpty(key)) return 0;
        var total = 0;
        lock (_perFile)
        {
            foreach (var tokens in _perFile.Values)
            {
                if (tokens.TryGetValue(key, out var n))
                    total += n;
            }
        }
        return total;
    }

    public void Clear()
    {
        lock (_perFile)
            _perFile.Clear();
    }

    private static string Normalize(string filePath) => filePath.Replace('\\', '/');
}
