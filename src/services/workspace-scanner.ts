import * as path from 'path';
import type { ResxFamily, TreeNode } from '../models/types';
import { getBaseName, parseLocaleFromFileName } from './naming';

export interface ScannedWorkspace {
  families: ResxFamily[];
  tree: TreeNode[];
}

/**
 * Group absolute .resx paths into families (neutral + satellites).
 */
export function groupResxFiles(
  files: string[],
  workspaceFolders: { name: string; uri: { fsPath: string } }[]
): ScannedWorkspace {
  const byKey = new Map<
    string,
    { basePath: string; files: Record<string, string>; dir: string; baseName: string }
  >();

  for (const filePath of files) {
    const normalized = path.normalize(filePath);
    const fileName = path.basename(normalized);
    const dir = path.dirname(normalized);
    const locale = parseLocaleFromFileName(fileName);
    const baseName = getBaseName(fileName);
    const familyKey = path.join(dir, baseName).toLowerCase();

    let group = byKey.get(familyKey);
    if (!group) {
      group = {
        basePath: '',
        files: {},
        dir,
        baseName,
      };
      byKey.set(familyKey, group);
    }
    group.files[locale] = normalized;
    if (!locale) {
      group.basePath = normalized;
    }
  }

  // Prefer neutral as basePath; otherwise first available
  for (const group of byKey.values()) {
    if (!group.basePath) {
      const first = Object.values(group.files)[0];
      group.basePath = first;
    }
  }

  const families: ResxFamily[] = [];
  for (const [key, group] of byKey) {
    const projectName = resolveProjectName(group.dir, workspaceFolders);
    const relDir = relativeDisplayDir(group.dir, workspaceFolders);
    const displayName = relDir
      ? `${relDir.replace(/\\/g, '/')}/${group.baseName}`
      : group.baseName;

    families.push({
      id: key,
      basePath: group.basePath,
      displayName,
      projectName,
      files: group.files,
    });
  }

  families.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  );

  return { families, tree: buildTree(families) };
}

function resolveProjectName(
  dir: string,
  folders: { name: string; uri: { fsPath: string } }[]
): string {
  const normalized = path.normalize(dir).toLowerCase();
  for (const folder of folders) {
    const root = path.normalize(folder.uri.fsPath).toLowerCase();
    if (normalized === root || normalized.startsWith(root + path.sep.toLowerCase()) || normalized.startsWith(root + '\\') || normalized.startsWith(root + '/')) {
      // Try to find a .csproj nearby for a nicer name
      return folder.name;
    }
  }
  return folders[0]?.name ?? 'Workspace';
}

function relativeDisplayDir(
  dir: string,
  folders: { name: string; uri: { fsPath: string } }[]
): string {
  for (const folder of folders) {
    const root = path.normalize(folder.uri.fsPath);
    const normalized = path.normalize(dir);
    if (normalized.toLowerCase().startsWith(root.toLowerCase())) {
      const rel = path.relative(root, normalized);
      return rel === '' ? '' : rel;
    }
  }
  return path.basename(dir);
}

export function buildTree(families: ResxFamily[]): TreeNode[] {
  const projects = new Map<string, Map<string, ResxFamily[]>>();

  for (const family of families) {
    let folders = projects.get(family.projectName);
    if (!folders) {
      folders = new Map();
      projects.set(family.projectName, folders);
    }
    const folderLabel = path.dirname(family.displayName.replace(/\\/g, '/'));
    const key = folderLabel === '.' ? '' : folderLabel;
    let list = folders.get(key);
    if (!list) {
      list = [];
      folders.set(key, list);
    }
    list.push(family);
  }

  const tree: TreeNode[] = [];
  for (const [projectName, folders] of projects) {
    const projectNode: TreeNode = {
      id: `project:${projectName}`,
      label: projectName,
      kind: 'project',
      children: [],
    };

    for (const [folder, list] of folders) {
      const familyNodes: TreeNode[] = list.map((f) => ({
        id: `family:${f.id}`,
        label: path.basename(f.displayName),
        kind: 'family' as const,
        familyId: f.id,
        checked: true,
      }));

      if (!folder) {
        projectNode.children!.push(...familyNodes);
      } else {
        projectNode.children!.push({
          id: `folder:${projectName}:${folder}`,
          label: folder,
          kind: 'folder',
          children: familyNodes,
        });
      }
    }

    tree.push(projectNode);
  }

  return tree;
}
