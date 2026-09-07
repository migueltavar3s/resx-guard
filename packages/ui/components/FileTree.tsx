import type { TreeNode } from '@resx-guard/core-ts';
import { t } from '../i18n';
import { usePersistedSet } from '../hooks/usePersistedSet';

interface Props {
  nodes: TreeNode[];
  onToggleFamily: (familyId: string, checked: boolean) => void;
  onToggleNode: (node: TreeNode, checked: boolean) => void;
}

export function FileTree({ nodes, onToggleFamily, onToggleNode }: Props) {
  const [collapsed, toggleFold] = usePersistedSet('resxGuard.treeFold.v1');

  return (
    <div className="file-tree">
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          collapsed={collapsed}
          onToggleFold={toggleFold}
          onToggleFamily={onToggleFamily}
          onToggleNode={onToggleNode}
        />
      ))}
    </div>
  );
}

function TreeItem({
  node,
  collapsed,
  onToggleFold,
  onToggleFamily,
  onToggleNode,
}: {
  node: TreeNode;
  collapsed: Set<string>;
  onToggleFold: (id: string) => void;
  onToggleFamily: (familyId: string, checked: boolean) => void;
  onToggleNode: (node: TreeNode, checked: boolean) => void;
}) {
  const checked = isFullyChecked(node);
  const indeterminate = !checked && isPartiallyChecked(node);
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const open = !collapsed.has(node.id);

  return (
    <div className="tree-node">
      <div className="tree-row">
        {hasChildren ? (
          <button
            type="button"
            className={`tree-twistie${open ? '' : ' collapsed'}`}
            aria-label={open ? t('tree.collapse', node.label) : t('tree.expand', node.label)}
            aria-expanded={open}
            onClick={() => onToggleFold(node.id)}
          />
        ) : (
          <span className="tree-twistie spacer" aria-hidden />
        )}
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
          <span className="tree-name">{node.label}</span>
        </label>
      </div>
      {hasChildren && open && (
        <div className="tree-children">
          {children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              collapsed={collapsed}
              onToggleFold={onToggleFold}
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
