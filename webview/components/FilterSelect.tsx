import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

export function FilterSelect<T extends string>({ value, options, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const selected = options.find((o) => o.value === value) ?? options[0];

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
        width: Math.max(rect.width, 168),
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

  return (
    <div className="filter-select" ref={wrapRef}>
      <button
        type="button"
        className={`col-filter filter-select-trigger ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="filter-select-label">{selected?.label}</span>
        <span className="filter-select-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open &&
        createPortal(
          <ul
            ref={menuRef}
            className="filter-select-menu"
            role="listbox"
            style={{ top: menuPos.top, left: menuPos.left, minWidth: menuPos.width }}
          >
            {options.map((opt) => (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className={`filter-select-option ${opt.value === value ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
