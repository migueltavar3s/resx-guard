import type { TreeNode } from '../../src/models/types';

interface Props {
  nodes: TreeNode[];
  onToggleFamily: (familyId: string, checked: boolean) => void;
  onToggleNode: (node: TreeNode, checked: boolean) => void;
}

export function FileTree({ nodes, onToggleFamily, onToggleNode }: Props) {
  return (
    <div>
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          onToggleFamily={onToggleFamily}
          onToggleNode={onToggleNode}
        />
      ))}
    </div>
  );
}

function TreeItem({
  node,
  onToggleFamily,
  onToggleNode,
}: {
  node: TreeNode;
  onToggleFamily: (familyId: string, checked: boolean) => void;
  onToggleNode: (node: TreeNode, checked: boolean) => void;
}) {
  const checked = isFullyChecked(node);
  const indeterminate = !checked && isPartiallyChecked(node);

  return (
    <div className="tree-node">
      <label className="tree-label">
        <input
          type="checkbox"
          checked={checked}
          ref={(el) => {
            if (el) {
              el.indeterminate = indeterminate;
            }
          }}
          onChange={(e) => {
            if (node.kind === 'family' && node.familyId) {
              onToggleFamily(node.familyId, e.target.checked);
            } else {
              onToggleNode(node, e.target.checked);
            }
          }}
        />
        <span>{node.label}</span>
      </label>
      {node.children && node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              onToggleFamily={onToggleFamily}
              onToggleNode={onToggleNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function isFullyChecked(node: TreeNode): boolean {
  if (node.kind === 'family') {
    return !!node.checked;
  }
  const children = node.children ?? [];
  return children.length > 0 && children.every(isFullyChecked);
}

function isPartiallyChecked(node: TreeNode): boolean {
  if (node.kind === 'family') {
    return !!node.checked;
  }
  const children = node.children ?? [];
  return children.some((c) => isFullyChecked(c) || isPartiallyChecked(c));
}
