import type { ReactNode } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

/** Champs du formulaire « Agents IA » : listes et tableaux editables, sans mutation. */

export const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rs-red/30 focus:border-rs-red';
const iconBtn = 'p-1.5 rounded-md text-gray-400 hover:text-rs-black hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent';

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-t border-gray-100 pt-5 first:border-0 first:pt-0">
      <h4 className="text-sm font-semibold text-rs-black">{title}</h4>
      {hint && <p className="text-xs text-gray-500 mt-0.5 mb-3">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

/** Nombre facultatif : vide = null. */
export function NumberInput({ value, onChange, min = 0, placeholder }: {
  value: number | null; onChange: (v: number | null) => void; min?: number; placeholder?: string;
}) {
  return (
    <input
      type="number"
      min={min}
      className={inputCls}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  );
}

const move = <T,>(items: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
};

/** Liste de phrases (interdits, controles...). */
export function ListEditor({ items, onChange, placeholder, multiline = false }: {
  items: string[]; onChange: (v: string[]) => void; placeholder: string; multiline?: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 items-start">
          {multiline
            ? <textarea rows={2} className={inputCls} value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
            : <input className={inputCls} value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />}
          <button type="button" className={iconBtn} aria-label="Supprimer" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} className="flex items-center gap-1.5 text-xs font-medium text-rs-red hover:underline">
        <Plus size={14} /> {placeholder}
      </button>
    </div>
  );
}

/** Liste ordonnee de choix fixes (blocs de fin d'article). */
export function OrderedChoices<K extends string>({ value, onChange, labels }: {
  value: K[]; onChange: (v: K[]) => void; labels: Record<K, string>;
}) {
  const unused = (Object.keys(labels) as K[]).filter((k) => !value.includes(k));
  return (
    <div className="space-y-2">
      <ol className="space-y-1.5">
        {value.map((k, i) => (
          <li key={k} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <span className="w-5 text-xs font-semibold text-gray-400">{i + 1}.</span>
            <span className="flex-1">{labels[k]}</span>
            <button type="button" className={iconBtn} aria-label="Monter" disabled={i === 0} onClick={() => onChange(move(value, i, i - 1))}><ArrowUp size={14} /></button>
            <button type="button" className={iconBtn} aria-label="Descendre" disabled={i === value.length - 1} onClick={() => onChange(move(value, i, i + 1))}><ArrowDown size={14} /></button>
            <button type="button" className={iconBtn} aria-label="Retirer" onClick={() => onChange(value.filter((x) => x !== k))}><Trash2 size={14} /></button>
          </li>
        ))}
        {value.length === 0 && <li className="text-xs text-gray-400 italic">Aucun élément en fin d'article.</li>}
      </ol>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((k) => (
            <button key={k} type="button" onClick={() => onChange([...value, k])}
              className="flex items-center gap-1 text-xs border border-dashed border-gray-300 rounded-full px-2.5 py-1 text-gray-600 hover:border-rs-red hover:text-rs-red">
              <Plus size={12} /> {labels[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface Column<R> {
  key: keyof R & string;
  label: string;
  type?: 'text' | 'number';
  width?: string;
}

/** Tableau editable (auteurs -> ID WordPress, categories, formats HTML, modeles de titre). */
export function TableEditor<R extends Record<string, string | number | null>>({ rows, onChange, columns, empty, addLabel }: {
  rows: R[]; onChange: (v: R[]) => void; columns: Column<R>[]; empty: R; addLabel: string;
}) {
  const setCell = (i: number, key: keyof R, raw: string, type?: 'text' | 'number') => {
    const v = type === 'number' ? (raw === '' ? null : Number(raw)) : raw;
    onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  };
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              {columns.map((c) => <th key={c.key} className="font-medium pb-1 pr-2" style={{ width: c.width }}>{c.label}</th>)}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key} className="pr-2 py-1">
                    <input type={c.type === 'number' ? 'number' : 'text'} className={inputCls} value={r[c.key] ?? ''}
                      onChange={(e) => setCell(i, c.key, e.target.value, c.type)} />
                  </td>
                ))}
                <td>
                  <button type="button" className={iconBtn} aria-label="Supprimer la ligne" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => onChange([...rows, { ...empty }])} className="flex items-center gap-1.5 text-xs font-medium text-rs-red hover:underline">
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}
