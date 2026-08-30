using System;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;

namespace ResXGuard.Core;

public static class HostJson
{
    private static readonly JsonSerializerSettings Settings = new()
    {
        ContractResolver = new CamelCasePropertyNamesContractResolver(),
        Converters = { new StringEnumConverter(new CamelCaseNamingStrategy()) },
        NullValueHandling = NullValueHandling.Ignore,
    };

    public static string Serialize(object value) => JsonConvert.SerializeObject(value, Settings);

    public static JObject ParseWebMessage(string json) => JObject.Parse(json);

    /// <summary>
    /// Normalizes WebView2 payloads: object posts arrive as JSON; plain-string posts become { type: "..." }.
    /// </summary>
    public static string? NormalizeIncomingWebMessage(string? jsonPayload, string? plainText)
    {
        if (!string.IsNullOrWhiteSpace(jsonPayload))
            return jsonPayload;

        if (string.IsNullOrWhiteSpace(plainText))
            return null;

        plainText = plainText.Trim();
        return plainText.StartsWith("{", StringComparison.Ordinal)
            ? plainText
            : Serialize(new { type = plainText });
    }

    public static string SerializeSnapshot(IndexSnapshot snapshot) =>
        Serialize(new { type = "snapshot", payload = snapshot });
}
