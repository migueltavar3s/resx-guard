using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ResXGuard.Core;

public sealed class ResxIdentity
{
    public string Locale { get; init; } = "";
    public string BaseName { get; init; } = "";
    public string FamilyDir { get; init; } = "";
}

public static class Naming
{
    private static readonly HashSet<string> Iso6391 = new(
        ("aa ab ae af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de " +
        "dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id " +
        "ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu " +
        "lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu " +
        "rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr " +
        "ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu").Split(' '),
        StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> Iso6392 = new(StringComparer.OrdinalIgnoreCase)
        { "fil", "haw", "swb", "tlh", "zho", "cmn", "yue" };

    private static readonly HashSet<string> AmbiguousLang = new(StringComparer.OrdinalIgnoreCase)
        { "cs", "fs", "ts", "as", "ps" };

    public static ResxIdentity ResolveResxIdentity(string filePath, HashSet<string>? allNormalizedPaths = null)
    {
        var normalized = filePath.Replace('\\', '/');
        var slash = normalized.LastIndexOf('/');
        var fileName = slash >= 0 ? normalized.Substring(slash + 1) : normalized;
        var dir = slash >= 0 ? normalized.Substring(0, slash) : "";
        var baseName = Regex.Replace(fileName, @"\.resx$", "", RegexOptions.IgnoreCase);

        var suffix = CultureFromResourceBase(baseName, dir, allNormalizedPaths);
        if (suffix != null)
            return new ResxIdentity { Locale = suffix.Value.Locale, BaseName = suffix.Value.BaseName, FamilyDir = dir };

        var whole = CanonicalizeCulture(baseName);
        if (whole != null)
            return new ResxIdentity { Locale = whole, BaseName = "", FamilyDir = dir };

        var parentName = dir.Contains("/") ? dir.Substring(dir.LastIndexOf('/') + 1) : dir;
        var parentCulture = CanonicalizeCulture(parentName);
        var parentLang = parentCulture?.Split('-')[0]?.ToLowerInvariant() ?? "";
        if (parentCulture != null && !AmbiguousLang.Contains(parentLang) && allNormalizedPaths != null)
        {
            var familyDir = dir.Contains("/") ? dir.Substring(0, dir.LastIndexOf('/')) : "";
            var sibling = NormalizePathKey($"{familyDir}/{baseName}.resx");
            if (allNormalizedPaths.Contains(sibling))
                return new ResxIdentity { Locale = parentCulture, BaseName = baseName, FamilyDir = dir };
        }

        return new ResxIdentity { BaseName = baseName, FamilyDir = dir };
    }

    private static (string Locale, string BaseName)? CultureFromResourceBase(
        string baseName, string dir, HashSet<string>? allNormalizedPaths)
    {
        var lastDot = baseName.LastIndexOf('.');
        if (lastDot <= 0) return null;
        var raw = baseName.Substring(lastDot + 1);
        var locale = CanonicalizeCulture(raw);
        if (locale == null) return null;
        var lang = locale.Split('-')[0].ToLowerInvariant();
        if (AmbiguousLang.Contains(lang))
        {
            if (allNormalizedPaths == null) return null;
            var sibling = NormalizePathKey($"{dir}/{baseName.Substring(0, lastDot)}.resx");
            if (!allNormalizedPaths.Contains(sibling)) return null;
        }
        return (locale, baseName.Substring(0, lastDot));
    }

    public static string? CanonicalizeCulture(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var tag = raw.Replace('_', '-').Trim();
        var lang = tag.Split('-')[0].ToLowerInvariant();
        if (!Iso6391.Contains(lang) && !Iso6392.Contains(lang)) return null;
        try
        {
            return new CultureInfo(tag).Name;
        }
        catch
        {
            return null;
        }
    }

    public static string NormalizePathKey(string filePath) =>
        filePath.Replace('\\', '/').ToLowerInvariant();

    public static string ToPascalCaseKey(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return "";
        var cleaned = Regex.Replace(
            input.Normalize(NormalizationForm.FormKD).Replace("\u0300", "").Replace("\u0301", ""),
            @"[''`´]", "");
        cleaned = Regex.Replace(cleaned, @"[^a-zA-Z0-9]+", " ").Trim();
        if (string.IsNullOrEmpty(cleaned)) return "";
        var parts = cleaned.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        var sb = new StringBuilder();
        foreach (var part in parts)
        {
            if (part.Length == 0) continue;
            sb.Append(char.ToUpperInvariant(part[0]));
            if (part.Length > 1) sb.Append(part.Substring(1));
        }
        var result = sb.ToString();
        if (result.Length > 0 && char.IsDigit(result[0])) result = "N" + result;
        return result;
    }

    private static readonly Regex PlaceholderRegex = new(@"\{[^{}]+\}", RegexOptions.Compiled);

    public static List<string> ExtractPlaceholders(string text)
    {
        if (string.IsNullOrEmpty(text)) return new List<string>();
        var matches = PlaceholderRegex.Matches(text);
        var result = new List<string>();
        foreach (Match m in matches)
            if (!result.Contains(m.Value)) result.Add(m.Value);
        result.Sort(StringComparer.Ordinal);
        return result;
    }

    private static readonly Regex EndingSuffixRegex = new(@"([\s]*[.?!…:;]+[\s]*|[ \t\r\n]+)$", RegexOptions.Compiled);

    public static string ExtractEndingSuffix(string text)
    {
        if (string.IsNullOrEmpty(text)) return "";
        var m = EndingSuffixRegex.Match(text);
        return m.Success ? m.Value : "";
    }

    public static bool EndingsMatch(string neutral, string translation)
    {
        if (string.IsNullOrEmpty(translation)) return true;
        return ExtractEndingSuffix(neutral) == ExtractEndingSuffix(translation);
    }

    public static bool PlaceholdersMatch(string neutral, string translation)
    {
        if (string.IsNullOrEmpty(translation)) return true;
        var a = ExtractPlaceholders(neutral);
        var b = ExtractPlaceholders(translation);
        if (a.Count != b.Count) return false;
        for (var i = 0; i < a.Count; i++)
            if (a[i] != b[i]) return false;
        return true;
    }
}
