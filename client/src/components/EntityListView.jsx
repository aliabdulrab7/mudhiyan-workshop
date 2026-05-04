import { useMemo, useState } from 'react';
import { Icons } from './icons';
import Button from './ui/Button';
import Input from './ui/Input';
import Checkbox from './ui/Checkbox';

// Shared list view for CRUD entity pages.
//
// columns: [{ key, label, sortable?, render?, dir?, width? }]
//   render(item) → ReactNode (defaults to item[key])
//
// selectedIds: Set<number>
// renderRowActions(item) → ReactNode — edit / archive / restore / delete buttons
//
// The component owns sort state. Search filtering is also internal — pass
// all items (pre-filtered by include_archived) and this component filters by
// the search string across all string column values.
export default function EntityListView({
  items = [],
  columns = [],
  loading = false,
  error = '',
  showArchived = false,
  onToggleArchived,
  search = '',
  onSearch,
  selectedIds,
  onSelect,
  onSelectAll,
  renderRowActions,
  emptyMessage = 'لا توجد بيانات',
}) {
  const [sortKey, setSortKey] = useState(columns.find((c) => c.sortable)?.key ?? null);
  const [sortDir, setSortDir] = useState('asc');

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      columns.some((col) => {
        const v = item[col.key];
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }, [items, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), 'ar', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const allSelected = sorted.length > 0 && sorted.every((item) => selectedIds?.has(item.id));
  const someSelected = !allSelected && sorted.some((item) => selectedIds?.has(item.id));

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ flexGrow: 1, minWidth: 180, maxWidth: 320 }}>
          <Input
            placeholder="بحث..."
            value={search}
            onChange={(e) => onSearch?.(e.target.value)}
            testId="entity-list__search"
          />
        </div>
        {onToggleArchived && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', userSelect: 'none' }}>
            <Checkbox
              checked={showArchived}
              onChange={(checked) => onToggleArchived(checked)}
              aria-label="عرض المؤرشف"
            />
            عرض المؤرشف
          </label>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-faint)', textAlign: 'center', padding: 40, fontSize: 13 }}>
          جاري التحميل...
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ color: 'var(--text-faint)', textAlign: 'center', padding: 40, fontSize: 13, border: '1px dashed var(--border)', borderRadius: 8 }}>
          {emptyMessage}
        </div>
      ) : (
        <div className="items-table">
          {/* Header */}
          <div
            className="items-thead"
            style={{ gridTemplateColumns: `32px ${columns.map((c) => c.width ?? '1fr').join(' ')} auto` }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(checked) => onSelectAll?.(checked)}
                aria-label="تحديد الكل"
              />
            </div>
            {columns.map((col) => (
              <span
                key={col.key}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                style={{
                  cursor: col.sortable ? 'pointer' : 'default',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  userSelect: 'none',
                }}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <Icons.ChevDown
                    size={12}
                    style={{ transform: sortDir === 'asc' ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}
                  />
                )}
              </span>
            ))}
            <span />
          </div>

          {/* Rows */}
          {sorted.map((item) => {
            const isArchived = item.archived_at != null;
            const isSelected = selectedIds?.has(item.id) ?? false;
            return (
              <div
                key={item.id}
                className="items-row"
                style={{
                  gridTemplateColumns: `32px ${columns.map((c) => c.width ?? '1fr').join(' ')} auto`,
                  alignItems: 'center',
                  opacity: isArchived ? 0.55 : 1,
                  background: isSelected ? 'var(--primary-soft)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Checkbox
                    checked={isSelected}
                    onChange={(checked) => onSelect?.(item.id, checked)}
                    aria-label={`تحديد ${item.id}`}
                  />
                </div>
                {columns.map((col) => (
                  <span
                    key={col.key}
                    dir={col.dir}
                    style={{ fontSize: 13, color: 'var(--text)' }}
                    className={col.mono ? 'font-mono text-[12px]' : ''}
                  >
                    {col.render ? col.render(item) : (item[col.key] ?? '—')}
                  </span>
                ))}
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  {renderRowActions?.(item)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
