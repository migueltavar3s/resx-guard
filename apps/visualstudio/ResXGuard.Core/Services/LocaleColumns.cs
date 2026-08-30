namespace ResXGuard.Core;

public static class LocaleColumns
{
    public static List<string> MergeVisibleLocales(IReadOnlyList<string> current, IReadOnlyList<string> discovered)
    {
        if (discovered.Count == 0) return new List<string>();
        if (current.Count == 0) return discovered.ToList();
        var known = new HashSet<string>(discovered);
        var kept = current.Where(known.Contains).ToList();
        var added = discovered.Where(l => !current.Contains(l)).ToList();
        var next = kept.Concat(added).ToList();
        return next.Count > 0 ? next : discovered.ToList();
    }
}
