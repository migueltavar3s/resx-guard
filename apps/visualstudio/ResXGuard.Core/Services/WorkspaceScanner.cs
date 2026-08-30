namespace ResXGuard.Core;

public static class WorkspaceScanner
{
    public static ScannedWorkspace GroupResxFiles(IReadOnlyList<string> files, IReadOnlyList<WorkspaceFolder> workspaceFolders)
    {
        var byKey = new Dictionary<string, Group>(StringComparer.OrdinalIgnoreCase);
        var allNormalizedPaths = new HashSet<string>(files.Select(Naming.NormalizePathKey));

        foreach (var filePath in files)
        {
            var normalized = Path.GetFullPath(filePath);
            var identity = Naming.ResolveResxIdentity(filePath, allNormalizedPaths);
            var familyKey = $"{Naming.NormalizePathKey(identity.FamilyDir)}||{identity.BaseName.ToLowerInvariant()}";
            var displayDir = identity.FamilyDir.Replace('/', Path.DirectorySeparatorChar);

            if (!byKey.TryGetValue(familyKey, out var group))
            {
                group = new Group { Dir = displayDir, BaseName = identity.BaseName };
                byKey[familyKey] = group;
            }
            group.Files[identity.Locale] = normalized;
            if (string.IsNullOrEmpty(identity.Locale))
                group.BasePath = normalized;
        }

        foreach (var group in byKey.Values)
        {
            if (string.IsNullOrEmpty(group.BasePath) && group.Files.Count > 0)
                group.BasePath = group.Files.Values.First();
        }

        var families = new List<ResxFamily>();
        foreach (var entry in byKey)
        {
            var key = entry.Key;
            var group = entry.Value;
            var projectName = ResolveProjectName(group.Dir, workspaceFolders);
            var relDir = RelativeDisplayDir(group.Dir, workspaceFolders);
            var rel = relDir.Replace('\\', '/');
            var label = !string.IsNullOrEmpty(group.BaseName) ? group.BaseName : Path.GetFileName(rel) ?? "(resources)";
            var displayName = !string.IsNullOrEmpty(group.BaseName)
                ? (string.IsNullOrEmpty(rel) ? group.BaseName : $"{rel}/{group.BaseName}")
                : rel ?? label;

            families.Add(new ResxFamily
            {
                Id = key,
                BasePath = group.BasePath,
                DisplayName = displayName,
                ProjectName = projectName,
                Files = new Dictionary<string, string>(group.Files)
            });
        }

        families.Sort((a, b) => string.Compare(a.DisplayName, b.DisplayName, StringComparison.OrdinalIgnoreCase));
        return new ScannedWorkspace { Families = families, Tree = BuildTree(families) };
    }

    private sealed class Group
    {
        public string BasePath = "";
        public Dictionary<string, string> Files = new();
        public string Dir = "";
        public string BaseName = "";
    }

    private static string ResolveProjectName(string dir, IReadOnlyList<WorkspaceFolder> folders)
    {
        var normalized = Path.GetFullPath(dir).ToLowerInvariant();
        foreach (var folder in folders)
        {
            var root = Path.GetFullPath(folder.FsPath).ToLowerInvariant();
            if (normalized == root || normalized.StartsWith(root + Path.DirectorySeparatorChar))
                return folder.Name;
        }
        return folders.Count > 0 ? folders[0].Name : "Workspace";
    }

    private static string RelativeDisplayDir(string dir, IReadOnlyList<WorkspaceFolder> folders)
    {
        foreach (var folder in folders)
        {
            var root = Path.GetFullPath(folder.FsPath);
            var normalized = Path.GetFullPath(dir);
            if (normalized.StartsWith(root, StringComparison.OrdinalIgnoreCase))
            {
                if (normalized.Length <= root.Length) return "";
                var sep = normalized[root.Length];
                if (sep == Path.DirectorySeparatorChar || sep == '/')
                    return normalized.Substring(root.Length + 1);
            }
        }
        return Path.GetFileName(dir) ?? "";
    }

    public static List<TreeNode> BuildTree(IReadOnlyList<ResxFamily> families)
    {
        var projects = new Dictionary<string, Dictionary<string, List<ResxFamily>>>(StringComparer.Ordinal);

        foreach (var family in families)
        {
            if (!projects.TryGetValue(family.ProjectName, out var folders))
            {
                folders = new Dictionary<string, List<ResxFamily>>(StringComparer.Ordinal);
                projects[family.ProjectName] = folders;
            }
            var folderLabel = Path.GetDirectoryName(family.DisplayName.Replace('\\', '/')) ?? "";
            var key = folderLabel == "." || folderLabel == "" ? "" : folderLabel;
            if (!folders.TryGetValue(key, out var list))
            {
                list = new List<ResxFamily>();
                folders[key] = list;
            }
            list.Add(family);
        }

        var tree = new List<TreeNode>();
        foreach (var projectEntry in projects)
        {
            var projectName = projectEntry.Key;
            var folders = projectEntry.Value;
            var projectNode = new TreeNode
            {
                Id = $"project:{projectName}",
                Label = projectName,
                Kind = "project",
                Children = new List<TreeNode>()
            };

            foreach (var folderEntry in folders)
            {
                var folder = folderEntry.Key;
                var list = folderEntry.Value;
                var familyNodes = list.Select(f => new TreeNode
                {
                    Id = $"family:{f.Id}",
                    Label = Path.GetFileName(f.DisplayName),
                    Kind = "family",
                    FamilyId = f.Id,
                    Checked = true
                }).ToList();

                if (string.IsNullOrEmpty(folder))
                    projectNode.Children!.AddRange(familyNodes);
                else
                    projectNode.Children!.Add(new TreeNode
                    {
                        Id = $"folder:{projectName}:{folder}",
                        Label = folder,
                        Kind = "folder",
                        Children = familyNodes
                    });
            }
            tree.Add(projectNode);
        }
        return tree;
    }
}
