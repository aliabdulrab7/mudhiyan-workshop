import Checkbox from './Checkbox';

/**
 * DataTable — dense operational table with right-border hover accent (RTL).
 *
 * columns: Array<{
 *   key: string,
 *   label: string,
 *   align?: 'start'|'end'|'center',
 *   mono?: boolean,
 *   width?: string|number,
 *   render?: (row) => ReactNode,
 * }>
 *
 * selected: Set<key> | undefined — omit to hide checkboxes
 * onSelect: (newSet) => void
 * getRowKey: (row) => string|number
 * getRowTestId?: (row) => string   — optional; falls back to getRowKey
 * onRowClick: (row) => void
 * testIdPrefix?: string            — when set, emits `${prefix}__select-all`,
 *                                    `${prefix}__row__${id}`, `${prefix}__row__${id}__select`.
 *                                    Primitive is caller-scoped: only emits testids when asked.
 */
export default function DataTable({ columns, rows, selected, onSelect, getRowKey, getRowTestId, onRowClick, testIdPrefix }) {
  const allSelected = selected?.size === rows.length && rows.length > 0;
  const someSelected = selected?.size > 0 && !allSelected;
  const rowTestId = getRowTestId || getRowKey;

  if (rows.length === 0) {
    return (
      <div className="bg-bg-raised border border-border rounded overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-faint">
          <svg className="w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-sm">لا توجد طلبات</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-raised border border-border rounded overflow-hidden">
      <table className="w-full border-collapse">
        <thead className="bg-bg-soft border-b border-border">
          <tr>
            {onSelect && (
              <th className="w-9 px-2 py-2.5 text-start">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={v => onSelect(v ? new Set(rows.map(getRowKey)) : new Set())}
                  testId={testIdPrefix ? `${testIdPrefix}__select-all` : undefined}
                />
              </th>
            )}
            {columns.map(col => (
              <th
                key={col.key}
                className={`px-3 py-2.5 text-[11px] uppercase tracking-wider text-text-muted font-medium text-${col.align || 'start'}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = getRowKey(row);
            const tid = testIdPrefix ? `${testIdPrefix}__row__${rowTestId(row)}` : undefined;
            const isSel = selected?.has(key);
            return (
              <tr
                key={key}
                data-testid={tid}
                className={`order-row border-b border-border-faint last:border-0 cursor-pointer ${isSel ? 'bg-[var(--primary-soft)]' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {onSelect && (
                  <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={isSel}
                      onChange={v => {
                        const next = new Set(selected);
                        v ? next.add(key) : next.delete(key);
                        onSelect(next);
                      }}
                      testId={tid ? `${tid}__select` : undefined}
                    />
                  </td>
                )}
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`px-3 py-2.5 text-sm text-${col.align || 'start'} ${col.mono ? 'font-mono tabular-nums' : ''}`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
