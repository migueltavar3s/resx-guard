using System.Text;
using System.Xml.Linq;

namespace ResXGuard.Core;

public enum ResxEncoding { Utf8, Utf16Le }

public static class ResxParser
{
    private static readonly XNamespace Xsd = "http://www.w3.org/2001/XMLSchema";
    private static readonly XNamespace Msdata = "urn:schemas-microsoft-com:xml-msdata";

    public static string CreateEmptyResxXml() =>
        """
        <?xml version="1.0" encoding="utf-8"?>
        <root>
          <xsd:schema id="root" xmlns="" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">
            <xsd:element name="root" msdata:IsDataSet="true">
            </xsd:element>
          </xsd:schema>
          <resheader name="resmimetype">
            <value>text/microsoft-resx</value>
          </resheader>
          <resheader name="version">
            <value>2.0</value>
          </resheader>
          <resheader name="reader">
            <value>System.Resources.ResXResourceReader, System.Windows.Forms, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089</value>
          </resheader>
          <resheader name="writer">
            <value>System.Resources.ResXResourceWriter, System.Windows.Forms, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089</value>
          </resheader>
        </root>
        """;

    public static (string Text, ResxEncoding Encoding) DetectAndDecodeResx(byte[] buffer)
    {
        if (buffer.Length >= 2 && buffer[0] == 0xff && buffer[1] == 0xfe)
            return (Encoding.Unicode.GetString(buffer, 2, buffer.Length - 2), ResxEncoding.Utf16Le);
        if (buffer.Length >= 3 && buffer[0] == 0xef && buffer[1] == 0xbb && buffer[2] == 0xbf)
            return (Encoding.UTF8.GetString(buffer, 3, buffer.Length - 3), ResxEncoding.Utf8);
        if (LooksLikeUtf16Le(buffer))
            return (Encoding.Unicode.GetString(buffer), ResxEncoding.Utf16Le);
        return (Encoding.UTF8.GetString(buffer), ResxEncoding.Utf8);
    }

    private static bool LooksLikeUtf16Le(byte[] buffer)
    {
        if (buffer.Length < 8 || buffer.Length % 2 != 0) return false;
        var sample = Math.Min(buffer.Length, 200);
        var zerosOnOdd = 0;
        for (var i = 1; i < sample; i += 2)
            if (buffer[i] == 0) zerosOnOdd++;
        return zerosOnOdd > sample / 4;
    }

    public static Task<ResxFile> ParseResxFileAsync(string filePath, CancellationToken ct = default) =>
        Task.Run(() =>
        {
            ct.ThrowIfCancellationRequested();
            var buffer = File.ReadAllBytes(filePath);
            var (text, _) = DetectAndDecodeResx(buffer);
            return ParseResxXml(text, filePath);
        }, ct);

    public static ResxFile ParseResxXml(string xml, string filePath)
    {
        var locale = Naming.ResolveResxIdentity(filePath).Locale;
        XDocument doc;
        try
        {
            doc = XDocument.Parse(xml, LoadOptions.PreserveWhitespace);
        }
        catch
        {
            return new ResxFile { Path = filePath, Locale = locale };
        }

        var root = doc.Root;
        if (root == null)
            return new ResxFile { Path = filePath, Locale = locale };

        var entries = new List<ResxEntry>();
        var seen = new Dictionary<string, int>(StringComparer.Ordinal);
        var duplicateKeys = new List<string>();

        foreach (var data in root.Elements().Where(e => e.Name.LocalName == "data"))
        {
            var name = data.Attribute("name")?.Value;
            if (string.IsNullOrEmpty(name) || !IsPlainStringData(data)) continue;

            var valueEl = data.Elements().FirstOrDefault(e => e.Name.LocalName == "value");
            var commentEl = data.Elements().FirstOrDefault(e => e.Name.LocalName == "comment");
            entries.Add(new ResxEntry
            {
                Key = name,
                Value = valueEl?.Value ?? "",
                Comment = commentEl?.Value ?? ""
            });

            seen.TryGetValue(name, out var count);
            count++;
            seen[name] = count;
            if (count == 2) duplicateKeys.Add(name);
        }

        return new ResxFile
        {
            Path = filePath,
            Locale = locale,
            Entries = entries,
            DuplicateKeys = duplicateKeys
        };
    }

    private static bool IsPlainStringData(XElement data)
    {
        var mime = data.Attribute("mimetype")?.Value?.Trim();
        if (!string.IsNullOrEmpty(mime)) return false;
        var type = data.Attribute("type")?.Value?.Trim() ?? "";
        if (string.IsNullOrEmpty(type)) return true;
        var typeName = type.Split(',')[0].Trim();
        return System.Text.RegularExpressions.Regex.IsMatch(typeName, @"^(System\.)?(String|Char)$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }

    public static async Task SetResxValueAsync(string filePath, string key, string value, string? comment = null, CancellationToken ct = default)
    {
        var (doc, encoding) = await LoadOrCreateDocAsync(filePath, ct).ConfigureAwait(false);
        var root = EnsureRoot(doc);
        var data = FindDataElement(root, key);
        if (data == null)
        {
            data = CreateDataElement(key, value, comment);
            root.Add(new XText("\n  "));
            root.Add(data);
        }
        else
        {
            var valueEl = data.Elements().FirstOrDefault(e => e.Name.LocalName == "value");
            if (valueEl == null)
            {
                valueEl = new XElement("value", value);
                data.Add(valueEl);
            }
            else valueEl.Value = value;

            if (comment != null)
            {
                var commentEl = data.Elements().FirstOrDefault(e => e.Name.LocalName == "comment");
                if (commentEl == null)
                {
                    commentEl = new XElement("comment", comment);
                    data.Add(commentEl);
                }
                else commentEl.Value = comment;
            }
        }
        await WriteResxTextAsync(filePath, doc.ToString(SaveOptions.DisableFormatting), encoding, ct).ConfigureAwait(false);
    }

    public static async Task AddResxEntryAsync(string filePath, string key, string value, string comment = "", CancellationToken ct = default) =>
        await SetResxValueAsync(filePath, key, value, comment, ct).ConfigureAwait(false);

    public static async Task DeleteResxEntryAsync(string filePath, string key, CancellationToken ct = default)
    {
        var (doc, encoding) = await LoadOrCreateDocAsync(filePath, ct).ConfigureAwait(false);
        var root = EnsureRoot(doc);
        var data = FindDataElement(root, key);
        data?.Remove();
        await WriteResxTextAsync(filePath, doc.ToString(SaveOptions.DisableFormatting), encoding, ct).ConfigureAwait(false);
    }

    public static async Task RenameResxKeyAsync(string filePath, string oldKey, string newKey, CancellationToken ct = default)
    {
        var (doc, encoding) = await LoadOrCreateDocAsync(filePath, ct).ConfigureAwait(false);
        var root = EnsureRoot(doc);
        var data = FindDataElement(root, oldKey);
        data?.SetAttributeValue("name", newKey);
        await WriteResxTextAsync(filePath, doc.ToString(SaveOptions.DisableFormatting), encoding, ct).ConfigureAwait(false);
    }

    private static Task<(XDocument Doc, ResxEncoding Encoding)> LoadOrCreateDocAsync(string filePath, CancellationToken ct) =>
        Task.Run(() =>
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var buffer = File.ReadAllBytes(filePath);
                var (text, encoding) = DetectAndDecodeResx(buffer);
                return (XDocument.Parse(text, LoadOptions.PreserveWhitespace), encoding);
            }
            catch
            {
                Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
                var xml = CreateEmptyResxXml();
                File.WriteAllText(filePath, xml, Encoding.UTF8);
                return (XDocument.Parse(xml, LoadOptions.PreserveWhitespace), ResxEncoding.Utf8);
            }
        }, ct);

    private static Task WriteResxTextAsync(string filePath, string xml, ResxEncoding encoding, CancellationToken ct) =>
        Task.Run(() =>
        {
            ct.ThrowIfCancellationRequested();
            if (encoding == ResxEncoding.Utf16Le)
            {
                var bytes = Encoding.Unicode.GetBytes(xml);
                var withBom = new byte[bytes.Length + 2];
                withBom[0] = 0xff;
                withBom[1] = 0xfe;
                Buffer.BlockCopy(bytes, 0, withBom, 2, bytes.Length);
                File.WriteAllBytes(filePath, withBom);
            }
            else
            {
                File.WriteAllText(filePath, xml, Encoding.UTF8);
            }
        }, ct);

    private static XElement EnsureRoot(XDocument doc)
    {
        if (doc.Root == null)
        {
            doc.Add(new XElement("root"));
        }
        return doc.Root!;
    }

    private static XElement? FindDataElement(XElement root, string key) =>
        root.Elements().FirstOrDefault(e => e.Name.LocalName == "data" && e.Attribute("name")?.Value == key);

    private static XElement CreateDataElement(string key, string value, string? comment)
    {
        var data = new XElement("data",
            new XAttribute("name", key),
            new XAttribute(XNamespace.Xml + "space", "preserve"),
            new XElement("value", value));
        if (!string.IsNullOrEmpty(comment))
            data.Add(new XElement("comment", comment));
        return data;
    }
}