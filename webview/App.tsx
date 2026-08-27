import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ExtensionSettings,
  IndexSnapshot,
  ResourceRow,
  TreeNode,
} from '../src/models/types';
import { setLanguage, t } from './i18n';
import { onHostMessage, post } from './vscodeApi';
import { FileTree } from './components/FileTree';
import { ResourceGrid } from './components/ResourceGrid';
import { SummaryPanel } from './components/SummaryPanel';
import { LanguagesPage } from './components/LanguagesPage';
import { SettingsPage } from './components/SettingsPage';
import { AddEntryModal } from './components/AddEntryModal';

type Tab = 'main' | 'languages' | 'settings';

function normalize(text: string): string {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function App() {
  const [snapshot, setSnapshot] = useState<IndexSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>('main');
  const [query, setQuery] = useState('');
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [selected, setSelected] = useState<ResourceRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const dispose = onHostMessage((msg) => {
      if (msg.type === 'snapshot') {
        setLanguage(msg.payload.language);
        setSnapshot(msg.payload);
        setSelected((prev) => {
          if (!prev) {
            return null;
          }
          return (
            msg.payload.rows.find(
              (r) => r.familyId === prev.familyId && r.key === prev.key
            ) ?? null
          );
        });
      }
    });
    post({ type: 'ready' });
    return dispose;
  }, []);

  const familyLabel = useCallback(
    (familyId: string) => {
      return snapshot?.families.find((f) => f.id === familyId)?.displayName ?? familyId;
    },
    [snapshot]
  );

  const filteredRows = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    const q = normalize(query.trim());
    return snapshot.rows.filter((row) => {
      if (issuesOnly && row.issues.length === 0) {
        return false;
      }
      if (!q) {
        return true;
      }
      if (normalize(row.key).includes(q)) {
        return true;
      }
      if (normalize(row.comment).includes(q)) {
        return true;
      }
      return Object.values(row.values).some((v) => normalize(v ?? '').includes(q));
    });
  }, [snapshot, query, issuesOnly]);

  const visibleLocales = snapshot?.visibleLocales ?? [];
  const allLocales = snapshot?.locales ?? [];

  const onToggleFamily = (familyId: string, checked: boolean) => {
    if (!snapshot) {
      return;
    }
    const set = new Set(snapshot.selectedFamilyIds);
    if (checked) {
      set.add(familyId);
    } else {
      set.delete(familyId);
    }
    post({ type: 'setSelectedFamilies', familyIds: [...set] });
  };

  const onToggleTree = (node: TreeNode, checked: boolean) => {
    if (!snapshot) {
      return;
    }
    const ids = collectFamilyIds(node);
    const set = new Set(snapshot.selectedFamilyIds);
    for (const id of ids) {
      if (checked) {
        set.add(id);
      } else {
        set.delete(id);
      }
    }
    post({ type: 'setSelectedFamilies', familyIds: [...set] });
  };

  const updateSettings = (partial: Partial<ExtensionSettings>) => {
    post({ type: 'updateSettings', settings: partial });
  };

  if (!snapshot) {
    return <div className="loading">{t('loading')}</div>;
  }

  return (
    <div className="app">
      <nav className="tabs">
        {(['main', 'languages', 'settings'] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {t(`tab.${id}`)}
          </button>
        ))}
      </nav>

      {tab === 'main' && (
        <div className="main-layout">
          <aside className="sidebar">
            <div className="section-title">{t('files.title')}</div>
            {snapshot.tree.length === 0 ? (
              <div className="empty">{t('files.empty')}</div>
            ) : (
              <FileTree
                nodes={snapshot.tree}
                onToggleFamily={onToggleFamily}
                onToggleNode={onToggleTree}
              />
            )}
          </aside>

          <section className="center">
            <div className="toolbar">
              <input
                type="search"
                placeholder={t('search.placeholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={issuesOnly}
                  onChange={(e) => setIssuesOnly(e.target.checked)}
                />
                {t('filter.issuesOnly')}
              </label>
              <button
                type="button"
                className="btn primary"
                disabled={snapshot.selectedFamilyIds.length === 0}
                onClick={() => setShowAdd(true)}
              >
                {t('toolbar.add')}
              </button>
              <button
                type="button"
                className="btn"
                disabled={!selected}
                onClick={() => {
                  if (selected) {
                    post({
                      type: 'deleteEntry',
                      familyId: selected.familyId,
                      key: selected.key,
                    });
                    setSelected(null);
                  }
                }}
              >
                {t('toolbar.delete')}
              </button>
              <button type="button" className="btn" onClick={() => post({ type: 'refresh' })}>
                {t('toolbar.refresh')}
              </button>
            </div>

            <ResourceGrid
              rows={filteredRows}
              visibleLocales={visibleLocales}
              selected={selected}
              onSelect={setSelected}
              familyLabel={familyLabel}
              onUpdateCell={(familyId, key, locale, value) =>
                post({ type: 'updateCell', familyId, key, locale, value })
              }
              onRenameKey={(familyId, oldKey, newKey) =>
                post({ type: 'renameKey', familyId, oldKey, newKey })
              }
            />
          </section>

          <aside className="summary-panel">
            <SummaryPanel row={selected} locales={allLocales} />
          </aside>
        </div>
      )}

      {tab === 'languages' && (
        <div className="page">
          <LanguagesPage
            locales={allLocales}
            visibleLocales={visibleLocales}
            onChange={(locales) => post({ type: 'setVisibleLocales', locales })}
          />
        </div>
      )}

      {tab === 'settings' && (
        <div className="page">
          <SettingsPage settings={snapshot.settings} onChange={updateSettings} />
        </div>
      )}

      {showAdd && (
        <AddEntryModal
          families={snapshot.families.filter((f) =>
            snapshot.selectedFamilyIds.includes(f.id)
          )}
          keyNaming={snapshot.settings.keyNaming}
          onCancel={() => setShowAdd(false)}
          onConfirm={(familyId, key, neutralValue) => {
            post({ type: 'addEntry', familyId, key, neutralValue });
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

function collectFamilyIds(node: TreeNode): string[] {
  if (node.kind === 'family' && node.familyId) {
    return [node.familyId];
  }
  return (node.children ?? []).flatMap(collectFamilyIds);
}
