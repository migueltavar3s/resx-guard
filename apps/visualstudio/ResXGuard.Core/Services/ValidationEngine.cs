namespace ResXGuard.Core;

public static class ValidationEngine
{
    public static List<ValidationIssue> ValidateFamily(
        ResxFamily family,
        IReadOnlyList<ResxFile> files,
        ValidationRulesConfig rules,
        IReadOnlyList<string>? localesToCheck = null)
    {
        var issues = new List<ValidationIssue>();
        var byLocale = files.ToDictionary(f => f.Locale, f => f);

        if (!byLocale.TryGetValue(ResxConstants.NeutralLocale, out var neutral))
            neutral = files.FirstOrDefault();
        if (neutral == null) return issues;

        if (rules.DuplicateKeys)
        {
            foreach (var f in files)
            {
                foreach (var key in f.DuplicateKeys)
                {
                    issues.Add(new ValidationIssue
                    {
                        Rule = IssueRule.DuplicateKeys,
                        Severity = IssueSeverity.Error,
                        Message = $"Duplicate key \"{key}\" in {LocaleLabel(f.Locale)}",
                        Key = key,
                        Locale = f.Locale,
                        FamilyId = family.Id
                    });
                }
            }
        }

        var keys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var e in neutral.Entries) keys.Add(e.Key);
        foreach (var f in files)
            foreach (var e in f.Entries) keys.Add(e.Key);

        var locales = localesToCheck?.Count > 0
            ? localesToCheck.ToList()
            : family.Files.Keys.Union(byLocale.Keys).Distinct().ToList();

        foreach (var key in keys)
        {
            var neutralEntry = neutral.Entries.FirstOrDefault(e => e.Key == key);
            var neutralValue = neutralEntry?.Value ?? "";

            if (rules.KeyPascalCase && neutralEntry != null)
            {
                var expected = Naming.ToPascalCaseKey(neutralValue);
                if (!string.IsNullOrEmpty(expected) && key != expected)
                {
                    issues.Add(new ValidationIssue
                    {
                        Rule = IssueRule.KeyPascalCase,
                        Severity = IssueSeverity.Warning,
                        Message = $"Key should be PascalCase of neutral value: expected \"{expected}\"",
                        Key = key,
                        FamilyId = family.Id,
                        SuggestedKey = expected
                    });
                }
            }

            foreach (var locale in locales)
            {
                byLocale.TryGetValue(locale, out var file);
                var entry = file?.Entries.FirstOrDefault(e => e.Key == key);
                var value = entry?.Value ?? "";

                if (locale != neutral.Locale || file != neutral)
                {
                    if (rules.MissingTranslation && neutralEntry != null && string.IsNullOrEmpty(value))
                    {
                        if (family.Files.ContainsKey(locale))
                        {
                            issues.Add(new ValidationIssue
                            {
                                Rule = IssueRule.MissingTranslation,
                                Severity = IssueSeverity.Warning,
                                Message = $"Missing translation for {LocaleLabel(locale)}",
                                Key = key,
                                Locale = locale,
                                FamilyId = family.Id
                            });
                        }
                    }

                    if (!string.IsNullOrEmpty(value) && !string.IsNullOrEmpty(neutralValue))
                    {
                        if (rules.MatchingSuffix && !Naming.EndingsMatch(neutralValue, value))
                        {
                            issues.Add(new ValidationIssue
                            {
                                Rule = IssueRule.MatchingSuffix,
                                Severity = IssueSeverity.Warning,
                                Message = $"Ending does not match neutral for {LocaleLabel(locale)}",
                                Key = key,
                                Locale = locale,
                                FamilyId = family.Id
                            });
                        }
                        if (rules.Placeholders && !Naming.PlaceholdersMatch(neutralValue, value))
                        {
                            issues.Add(new ValidationIssue
                            {
                                Rule = IssueRule.Placeholders,
                                Severity = IssueSeverity.Warning,
                                Message = $"Placeholders differ from neutral for {LocaleLabel(locale)}",
                                Key = key,
                                Locale = locale,
                                FamilyId = family.Id
                            });
                        }
                    }
                }
            }
        }
        return issues;
    }

    public static List<ResourceRow> AttachIssuesToRows(IReadOnlyList<ResourceRow> rows, IReadOnlyList<ValidationIssue> issues)
    {
        var byKey = new Dictionary<string, List<ValidationIssue>>();
        foreach (var issue in issues)
        {
            var mapKey = $"{issue.FamilyId}::{issue.Key}";
            if (!byKey.TryGetValue(mapKey, out var list))
            {
                list = new List<ValidationIssue>();
                byKey[mapKey] = list;
            }
            list.Add(issue);
        }
        return rows.Select(row => new ResourceRow
        {
            FamilyId = row.FamilyId,
            Key = row.Key,
            Comment = row.Comment,
            Values = new Dictionary<string, string>(row.Values),
            Issues = byKey.TryGetValue($"{row.FamilyId}::{row.Key}", out var list) ? list : new List<ValidationIssue>()
        }).ToList();
    }

    public static List<ResourceRow> BuildRows(ResxFamily family, IReadOnlyList<ResxFile> files)
    {
        var keys = new Dictionary<string, (string Comment, Dictionary<string, string> Values)>(StringComparer.Ordinal);
        foreach (var file in files)
        {
            foreach (var entry in file.Entries)
            {
                if (!keys.TryGetValue(entry.Key, out var row))
                {
                    row = ("", new Dictionary<string, string>());
                    keys[entry.Key] = row;
                }
                row.Values[file.Locale] = entry.Value;
                if (file.Locale == ResxConstants.NeutralLocale && !string.IsNullOrEmpty(entry.Comment))
                    keys[entry.Key] = (entry.Comment, row.Values);
                else if (string.IsNullOrEmpty(row.Comment) && !string.IsNullOrEmpty(entry.Comment))
                    keys[entry.Key] = (entry.Comment, row.Values);
            }
        }

        var rows = keys.Select(kv => new ResourceRow
        {
            FamilyId = family.Id,
            Key = kv.Key,
            Comment = kv.Value.Comment,
            Values = kv.Value.Values,
            Issues = new List<ValidationIssue>()
        }).ToList();
        rows.Sort((a, b) => string.Compare(a.Key, b.Key, StringComparison.OrdinalIgnoreCase));
        return rows;
    }

    public static ExtensionSettings DefaultSettings() => new()
    {
        NeutralLocale = "",
        KeyNaming = "pascalFromNeutral",
        UpdateDesignerCs = true,
        VisibleLocales = new List<string>(),
        Rules = new ValidationRulesConfig()
    };

    private static string LocaleLabel(string locale) =>
        string.IsNullOrEmpty(locale) ? "Neutral" : locale;
}
