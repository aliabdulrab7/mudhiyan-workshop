import { useEffect, useState } from 'react';
import {
  getRepairOptions, createRepairOption, updateRepairOption, deleteRepairOption,
  archiveRepairOption, restoreRepairOption,
} from '../api/repair-options';
import { Icons } from '../components/icons';
import ArchiveConfirmDialog from '../components/ArchiveConfirmDialog';
import BulkActionBar from '../components/BulkActionBar';
import EntityFormModal from '../components/EntityFormModal';
import EntityListView from '../components/EntityListView';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import { useToast } from '../components/ToastProvider';

const ITEM_TYPES = ['خاتم', 'حلق', 'سوار', 'عقد', 'دبلة', 'ساعة', 'أخرى'];

const NEEDS_OPTIONS = [
  { value: '',      label: 'بدون تفاصيل' },
  { value: 'size',  label: 'مقاس (رقم)' },
  { value: 'stone', label: 'تفاصيل الحجر (نص)' },
  { value: 'color', label: 'لون (أصفر/روز/أبيض)' },
  { value: 'text',  label: 'نص حر' },
];

function needsLabel(needs) {
  return NEEDS_OPTIONS.find((o) => (o.value || null) === (needs || null))?.label ?? '—';
}

// repair_options has no FK references → ref-count is always 0.
const ZERO_REFS = () => Promise.resolve({ reference_count: 0, referencing_tables: [] });

const COLUMNS = [
  { key: 'value', label: 'الإصلاح', sortable: true, width: '1.5fr' },
  { key: 'needs', label: 'نوع التفاصيل', width: '1.2fr', render: (item) => needsLabel(item.needs) },
  {
    key: 'archived_at',
    label: 'الحالة',
    width: '72px',
    render: (item) => item.archived_at
      ? <span style={{ fontSize: 11, color: 'var(--text-faint)', background: 'var(--bg-soft)', padding: '1px 5px', borderRadius: 3 }}>مؤرشف</span>
      : null,
  },
];

const CREATE_FIELDS = [
  { key: 'value', label: 'اسم الإصلاح', required: true, placeholder: 'مثال: تغيير مقاس' },
  {
    key: 'needs',
    label: 'نوع التفاصيل',
    type: 'select',
    options: NEEDS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  },
];

export default function RepairOptionsPage() {
  const toast = useToast();

  const [allItems, setAllItems]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState('');
  const [activeType, setActiveType]     = useState(ITEM_TYPES[0]);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch]             = useState('');
  const [selectedIds, setSelectedIds]   = useState(new Set());

  const [formOpen, setFormOpen]         = useState(false);
  const [formMode, setFormMode]         = useState('create');
  const [editItem, setEditItem]         = useState(null);
  const [formLoading, setFormLoading]   = useState(false);
  const [formError, setFormError]       = useState('');

  const [archiveTarget, setArchiveTarget]         = useState(null);
  const [archiveConfirming, setArchiveConfirming] = useState(false);

  const [bulkArchiving, setBulkArchiving] = useState(false);

  useEffect(() => { document.title = 'خيارات الإصلاح | مضيان'; }, []);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      setAllItems(await getRepairOptions(null, { include_archived: showArchived }));
      setSelectedIds(new Set());
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  // Items for the active tab only.
  const tabItems = allItems.filter((r) => r.item_type === activeType);

  function switchTab(t) {
    setActiveType(t);
    setSearch('');
    setSelectedIds(new Set());
    setEditItem(null);
  }

  function openCreate() {
    setFormMode('create');
    setEditItem(null);
    setFormError('');
    setFormOpen(true);
  }
  function openEdit(item) {
    setFormMode('edit');
    setEditItem(item);
    setFormError('');
    setFormOpen(true);
  }

  async function handleFormSubmit(values) {
    setFormLoading(true);
    setFormError('');
    try {
      if (formMode === 'create') {
        await createRepairOption({
          item_type: activeType,
          value: values.value.trim(),
          needs: values.needs || null,
        });
      } else {
        await updateRepairOption(editItem.id, {
          value: values.value.trim(),
          needs: values.needs || null,
        });
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleRestore(item) {
    try {
      await restoreRepairOption(item.id);
      await load();
    } catch (e) {
      toast?.(e.message, 'error');
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchiveConfirming(true);
    try {
      await archiveRepairOption(archiveTarget.id);
      setArchiveTarget(null);
      await load();
    } catch (e) {
      toast?.(e.message, 'error');
    } finally {
      setArchiveConfirming(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`حذف "${item.value}" نهائياً؟`)) return;
    try {
      await deleteRepairOption(item.id);
      await load();
    } catch (e) {
      toast?.(e.message, 'error');
    }
  }

  async function handleBulkArchive() {
    setBulkArchiving(true);
    try {
      await Promise.all([...selectedIds].map((id) => archiveRepairOption(id)));
      await load();
    } catch (e) {
      toast?.(e.message, 'error');
    } finally {
      setBulkArchiving(false);
    }
  }

  function handleSelect(id, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function handleSelectAll(checked) {
    setSelectedIds(checked ? new Set(tabItems.map((i) => i.id)) : new Set());
  }

  function renderRowActions(item) {
    const isArchived = !!item.archived_at;
    return (
      <>
        {!isArchived && (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(item); }}
            testId={`repair-options__row__${item.id}__edit`}>
            تعديل
          </Button>
        )}
        {isArchived ? (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRestore(item); }}
            testId={`repair-options__row__${item.id}__restore`}>
            استعادة
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setArchiveTarget(item); }}
            testId={`repair-options__row__${item.id}__archive`}>
            أرشفة
          </Button>
        )}
        <Button
          variant="ghost" size="sm"
          icon={<Icons.X size={12} />}
          onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
          title="حذف نهائي"
          className="!px-1.5"
          testId={`repair-options__row__${item.id}__delete`}
        />
      </>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">خيارات الإصلاح</h1>
          <div className="page-sub">إدارة قوائم الإصلاح لكل نوع قطعة — تُستخدم في نموذج الصيانة الجديدة</div>
        </div>
        <div className="page-actions">
          <Button variant="primary" size="sm" icon={<Icons.Plus size={12} />} onClick={openCreate}
            testId="repair-options__add-button">
            إضافة خيار
          </Button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Item-type tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
          {ITEM_TYPES.map((t) => (
            <Chip
              key={t}
              active={t === activeType}
              count={allItems.filter((r) => r.item_type === t && !r.archived_at).length || undefined}
              onClick={() => switchTab(t)}
              testId={`repair-options__tab__${t}`}
            >
              {t}
            </Chip>
          ))}
        </div>

        {loadError && (
          <div style={{ marginBottom: 12 }}>
            <Alert variant="danger">{loadError}</Alert>
          </div>
        )}

        <EntityListView
          items={tabItems}
          columns={COLUMNS}
          loading={loading}
          showArchived={showArchived}
          onToggleArchived={(v) => setShowArchived(v)}
          search={search}
          onSearch={setSearch}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          renderRowActions={renderRowActions}
          emptyMessage={`لا توجد خيارات لنوع "${activeType}"${showArchived ? '' : ' النشطة'} — أضف الأول من أعلى`}
        />
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onBulkArchive={handleBulkArchive}
        loading={bulkArchiving}
      />

      <EntityFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        title={formMode === 'create'
          ? `إضافة خيار إلى قائمة ${activeType}`
          : `تعديل: ${editItem?.value}`}
        fields={CREATE_FIELDS}
        initialValues={editItem ?? {}}
        submitLabel={formMode === 'create' ? 'إضافة' : 'حفظ'}
        error={formError}
        loading={formLoading}
      />

      <ArchiveConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={confirmArchive}
        entityLabel="خيار الإصلاح"
        fetchRefCount={ZERO_REFS}
        confirming={archiveConfirming}
      />
    </div>
  );
}
