using System.Text;
using System.Text.RegularExpressions;

namespace ResXGuard.Core;

/// <summary>
/// Surgical .resx text edits so encoding, newlines, and the XML declaration stay intact.
/// </summary>
public static class ResxText
{
    private static readonly Regex DataOpen = new(@"<data\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex NameAttr = new(@"\bname\s*=\s*""([^""]*)""", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex RootClose = new(@"</root\s*>", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string DetectNewline(string text)
    {
        var crlf = 0;
        var lf = 0;
        for (var i = 0; i < text.Length; i++)
        {
            if (text[i] != '\n') continue;
            if (i > 0 && text[i - 1] == '\r') crlf++;
            else lf++;
        }
        return crlf > lf ? "\r\n" : "\n";
    }

    public static string EscapeXmlText(string value) =>
        value.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");

    public static string EscapeXmlAttr(string value) =>
        EscapeXmlText(value).Replace("\"", "&quot;");

    public static string RenameResxKeyInXml(string xml, string oldKey, string newKey)
    {
        var block = FindBlock(xml, oldKey);
        if (block == null) return xml;
        return ReplaceRange(xml, block.NameValueStart, block.NameValueEnd, EscapeXmlAttr(newKey));
    }

    public static string SetResxValueInXml(string xml, string key, string value, string? comment = null)
    {
        var block = FindBlock(xml, key);
        if (block == null)
            return InsertDataBlock(xml, key, value, comment);

        var next = xml;
        var escaped = EscapeXmlText(value);
        if (block.ValueInnerStart >= 0)
            next = ReplaceRange(next, block.ValueInnerStart, block.ValueInnerEnd, escaped);
        else
        {
            var newline = DetectNewline(xml);
            var indent = IndentOf(xml, block.Start);
            next = ReplaceRange(next, block.OpenTagEnd, block.OpenTagEnd, $"{newline}{indent}  <value>{escaped}</value>");
        }

        if (comment != null)
            next = SetResxCommentInXml(next, key, comment);
        return next;
    }

    public static string SetResxCommentInXml(string xml, string key, string comment)
    {
        var block = FindBlock(xml, key);
        if (block == null) return xml;
        var escaped = EscapeXmlText(comment);
        if (block.HasComment && block.CommentInnerStart >= 0)
            return ReplaceRange(xml, block.CommentInnerStart, block.CommentInnerEnd, escaped);

        var newline = DetectNewline(xml);
        var indent = IndentOf(xml, block.Start);
        var insertAt = block.OpenTagEnd;
        if (block.ValueInnerEnd >= 0)
        {
            var valueClose = IndexOfIgnoreCase(xml, "</value>", block.ValueInnerEnd);
            if (valueClose >= 0) insertAt = valueClose + "</value>".Length;
        }
        return ReplaceRange(xml, insertAt, insertAt, $"{newline}{indent}  <comment>{escaped}</comment>");
    }

    public static string DeleteResxEntryInXml(string xml, string key)
    {
        var block = FindBlock(xml, key);
        if (block == null) return xml;
        var start = block.Start;
        var end = block.End;
        while (start > 0 && (xml[start - 1] == ' ' || xml[start - 1] == '\t'))
            start--;
        if (end < xml.Length - 1 && xml[end] == '\r' && xml[end + 1] == '\n')
            end += 2;
        else if (end < xml.Length && xml[end] == '\n')
            end += 1;
        return xml.Substring(0, start) + xml.Substring(end);
    }

    public static string AddResxEntryInXml(string xml, string key, string value, string comment = "")
    {
        if (FindBlock(xml, key) != null)
            return SetResxValueInXml(xml, key, value, string.IsNullOrEmpty(comment) ? null : comment);
        return InsertDataBlock(xml, key, value, comment);
    }

    private static string InsertDataBlock(string xml, string key, string value, string? comment)
    {
        var newline = DetectNewline(xml);
        var blocks = FindRootDataBlocks(xml);
        var indent = blocks.Count > 0 ? IndentOf(xml, blocks[0].Start) : "  ";
        var commentXml = string.IsNullOrEmpty(comment)
            ? ""
            : $"{newline}{indent}  <comment>{EscapeXmlText(comment)}</comment>";
        var block =
            $"{indent}<data name=\"{EscapeXmlAttr(key)}\" xml:space=\"preserve\">{newline}{indent}  <value>{EscapeXmlText(value)}</value>{commentXml}{newline}{indent}</data>";
        var closeAt = RootCloseIndex(xml);
        var before = xml.Substring(0, closeAt);
        var needsNl = before.EndsWith("\n", StringComparison.Ordinal) ? "" : newline;
        return before + needsNl + block + newline + xml.Substring(closeAt);
    }

    private sealed class DataBlock
    {
        public int Start { get; init; }
        public int End { get; init; }
        public int OpenTagEnd { get; init; }
        public string Key { get; init; } = "";
        public int NameValueStart { get; init; }
        public int NameValueEnd { get; init; }
        public int ValueInnerStart { get; init; }
        public int ValueInnerEnd { get; init; }
        public int CommentInnerStart { get; init; }
        public int CommentInnerEnd { get; init; }
        public bool HasComment { get; init; }
    }

    private static DataBlock? FindBlock(string xml, string key) =>
        FindRootDataBlocks(xml).FirstOrDefault(b => b.Key == key);

    private static List<DataBlock> FindRootDataBlocks(string xml)
    {
        var blocks = new List<DataBlock>();
        var offset = 0;
        while (true)
        {
            var match = DataOpen.Match(xml, offset);
            if (!match.Success) break;
            var start = match.Index;
            var openTagEnd = xml.IndexOf('>', start);
            if (openTagEnd < 0) break;
            var openTag = xml.Substring(start, openTagEnd + 1 - start);
            if (Regex.IsMatch(openTag, @"/\s*>$"))
            {
                offset = openTagEnd + 1;
                continue;
            }
            var nameMatch = NameAttr.Match(openTag);
            if (!nameMatch.Success)
            {
                offset = openTagEnd + 1;
                continue;
            }
            var valueStartInTag = nameMatch.Index + nameMatch.Value.IndexOf('"') + 1;
            var closeAt = IndexOfIgnoreCase(xml, "</data>", openTagEnd + 1);
            if (closeAt < 0) break;
            var end = closeAt + "</data>".Length;
            var value = FindInnerElement(xml, openTagEnd + 1, closeAt, "value");
            var comment = FindInnerElement(xml, openTagEnd + 1, closeAt, "comment");
            blocks.Add(new DataBlock
            {
                Start = start,
                End = end,
                OpenTagEnd = openTagEnd + 1,
                Key = nameMatch.Groups[1].Value,
                NameValueStart = start + valueStartInTag,
                NameValueEnd = start + valueStartInTag + nameMatch.Groups[1].Length,
                ValueInnerStart = value?.Start ?? -1,
                ValueInnerEnd = value?.End ?? -1,
                CommentInnerStart = comment?.Start ?? -1,
                CommentInnerEnd = comment?.End ?? -1,
                HasComment = comment != null
            });
            offset = end;
        }
        return blocks;
    }

    private static (int Start, int End)? FindInnerElement(string xml, int innerStart, int innerEnd, string tag)
    {
        var open = new Regex($"<{tag}\\b[^>]*>", RegexOptions.IgnoreCase);
        var slice = xml.Substring(innerStart, innerEnd - innerStart);
        var openMatch = open.Match(slice);
        if (!openMatch.Success) return null;
        var contentStart = innerStart + openMatch.Index + openMatch.Length;
        var closeAt = IndexOfIgnoreCase(xml, $"</{tag}>", contentStart);
        if (closeAt < 0 || closeAt > innerEnd) return null;
        return (contentStart, closeAt);
    }

    private static string IndentOf(string xml, int index)
    {
        var i = index;
        while (i > 0 && xml[i - 1] != '\n') i--;
        var prefix = xml.Substring(i, index - i);
        return string.IsNullOrWhiteSpace(prefix) ? prefix : "  ";
    }

    private static int RootCloseIndex(string xml)
    {
        var match = RootClose.Match(xml);
        return match.Success ? match.Index : xml.Length;
    }

    private static string ReplaceRange(string xml, int start, int end, string insert) =>
        xml.Substring(0, start) + insert + xml.Substring(end);

    private static int IndexOfIgnoreCase(string haystack, string needle, int startIndex)
    {
        return haystack.IndexOf(needle, startIndex, StringComparison.OrdinalIgnoreCase);
    }
}
