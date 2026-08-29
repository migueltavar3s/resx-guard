import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';

export type ExcelAction = 'export' | 'import';

const STORAGE_KEY = 'resxGuard.excelAction.v1';

interface Props {
  exportDisabled: boolean;
  onExport: () => void;
  onImport: () => void;
}

function loadLast(): ExcelAction {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'import' ? 'import' : 'export';
  } catch {
    return 'export';
  }
}

function saveLast(action: ExcelAction): void {
  try {
    localStorage.setItem(STORAGE_KEY, action);
  } catch {
    /* ignore quota / private mode */
  }
}

function actionIcon(action: ExcelAction): string {
  return action === 'export' ? '⇧' : '⇩';
}

function actionLabel(action: ExcelAction): string {
  return action === 'export' ? t('toolbar.export') : t('toolbar.import');
}

export function ExcelMenu({ exportDisabled, onExport, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<ExcelAction>(loadLast);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const ordered: ExcelAction[] = last === 'import' ? ['import', 'export'] : ['export', 'import'];

  useEffect(() => {
    if (!open) {
      return;
    }
    const updatePos = () => {
      const el = wrapRef.current;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 140),
      });
    };
    updatePos();

    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', updatePos);
    };
  }, [open]);

  const run = (action: ExcelAction) => {
    if (action === 'export' && exportDisabled) {
      return;
    }
    setLast(action);
    saveLast(action);
    setOpen(false);
    if (action === 'export') {
      onExport();
    } else {
      onImport();
    }
  };

  return (
    <div className="excel-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`btn excel-trigger${open ? ' active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="btn-icon" aria-hidden>
          {actionIcon(last)}
        </span>
        {actionLabel(last)}
        <span className="excel-trigger-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="excel-menu"
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left, minWidth: menuPos.width }}
          >
            {ordered.map((action) => {
              const disabled = action === 'export' && exportDisabled;
              return (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  className={`excel-menu-item${action === last ? ' selected' : ''}`}
                  disabled={disabled}
                  onClick={() => run(action)}
                >
                  <span className="btn-icon" aria-hidden>
                    {actionIcon(action)}
                  </span>
                  {actionLabel(action)}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
