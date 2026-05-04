import { useEffect, useState } from 'react';
import {
  getRoles, createRole, updateRole, deleteRole,
  archiveRole, restoreRole, getRoleRefCount,
} from '../api/roles';
import { Icons } from '../components/icons';
import ArchiveConfirmDialog from '../components/ArchiveConfirmDialog';
import BulkActionBar from '../components/BulkActionBar';
import EntityFormModal from '../components/EntityFormModal';
import EntityListView from '../components/EntityListView';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import { useToast } from '../components/ToastProvider';

const CREATE_FIELDS = [
  { key: 'value',            label: 'القيمة (إنجليزي)', required: true, placeholder: 'e.g. senior_jeweler', dir: 'ltr' },
  { key: 'display_label_ar', label: 'الاسم العربي',     required: true, placeholder: 'مثال: صائغ كبير' },
];
const EDIT_FIELDS = [
  { key: 'display_label_ar', label: 'الاسم العربي', required: true },
];

const COLUMNS = [
  { key: 'value',            label: 'القيمة',      sortable: true, mono: true, dir: 'ltr', width: '1fr' },
  { key: 'display_label_ar', label: 'الاسم العربي', sortable: true, width: '1.5fr' },
  {
    key: 'archived_at',
    label: 'الحالة',
    width: '72px',
    render: (item) => item.archived_at
      ? <span style={{ fontSize: 11, color: 'var(--text-faint)', background: 'var(--bg-soft)', padding: '1px 5px', borderRadius: 3 }}>مؤرشف</span>
      : null,
  },
];

export default function RolesPage() {
  const toast = useToast();

  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch]             = useState('');
  const [selectedIds, setSelectedIds]   = useState(new Set());

  const [formOpen, setFormOpen]         = useState(false);
  const [formMode, setFormMode]         = useState('create');
  const [editItem, setEditItem]         = useState(null);
  const [formLoading, setFormLoading]   = useState(false);
  const [formError, setFormError]       = useState('');

  const [archiveTarget, setArchiveTarget]       = useState(null);
  const [archiveConfirming, setArchiveConfirming] = useState(false);

  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState('');

  const [bulkArchiving, setBulkArchiving] = useState(false);

  useEffect(() => { document.title = 'الأدوار | مضيان'; }, []);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      setItems(await getRoles({ include_archived: showArchived }));
      setSelectedIds(new Set());
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

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
        await createRole({ value: values.value.trim(), display_label_ar: values.display_label_ar.trim() });
      } else {
        await updateRole(editItem.id, { display_label_ar: values.display_label_ar.trim() });
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
      await restoreRole(item.id);
      await load();
    } catch (e) {
      toast?.(e.message, 'error');
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchiveConfirming(true);
    try {
      await archiveRole(archiveTarget.id);
      setArchiveTarget(null);
      await load();
    } catch (e) {
      toast?.(e.message, 'error');
    } finally {
      setArchiveConfirming(false);
    }
  }

  async function handleBulkArchive() {
    setBulkArchiving(true);
    try {
      await Promise.all([...selectedIds].map((id) => archiveRole(id)));
      await load();
    } catch (e) {
      toast?.(e.message, 'error');
    } finally {
      setBulkArchiving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteRole(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      if (e.reference_count > 0) {
        setDeleteError(`لا يمكن الحذف — الدور مرتبط بـ ${e.reference_count} فني. أرشفه أولاً إن أردت إخفاءه.`);
      } else {
        setDeleteError(e.message);
      }
    } finally {
      setDeleteLoading(false);
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
    setSelectedIds(checked ? new Set(items.map((i) => i.id)) : new Set());
  }

  function renderRowActions(item) {
    const isArchived = !!item.archived_at;
    return (
      <>
        {!isArchived && (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(item); }}
            testId={`roles__row__${item.id}__edit`}>
            تعديل
          </Button>
        )}
        {isArchived ? (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRestore(item); }}
            testId={`roles__row__${item.id}__restore`}>
            استعادة
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setArchiveTarget(item); }}
            testId={`roles__row__${item.id}__archive`}>
            أرشفة
          </Button>
        )}
        <Button
          variant="ghost" size="sm"
          icon={<Icons.X size={12} />}
          onClick={(e) => { e.stopPropagation(); setDeleteError(''); setDeleteTarget(item); }}
          title="حذف نهائي"
          className="!px-1.5"
          testId={`roles__row__${item.id}__delete`}
        />
      </>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">الأدوار</h1>
          <div className="page-sub">إدارة أدوار الفنيين — تُستخدم في التصفية والتقارير</div>
        </div>
        <div className="page-actions">
          <Button variant="primary" size="sm" icon={<Icons.Plus size={12} />} onClick={openCreate}
            testId="roles__add-button">
            إضافة دور
          </Button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {loadError && (
          <div style={{ marginBottom: 12 }}>
            <Alert variant="danger">{loadError}</Alert>
          </div>
        )}

        <EntityListView
          items={items}
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
          emptyMessage={showArchived ? 'لا توجد أدوار' : 'لا توجد أدوار نشطة — أضف الأول من أعلى'}
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
        title={formMode === 'create' ? 'إضافة دور جديد' : `تعديل: ${editItem?.display_label_ar || editItem?.value}`}
        fields={formMode === 'create' ? CREATE_FIELDS : EDIT_FIELDS}
        initialValues={editItem ?? {}}
        submitLabel={formMode === 'create' ? 'إضافة' : 'حفظ'}
        error={formError}
        loading={formLoading}
      />

      <ArchiveConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={confirmArchive}
        entityLabel="الدور"
        fetchRefCount={() => getRoleRefCount(archiveTarget?.id)}
        confirming={archiveConfirming}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        title="حذف دور نهائياً"
        size="sm"
        testId="roles__delete-dialog"
      >
        <Dialog.Body>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>
            سيُحذف الدور <strong>"{deleteTarget?.display_label_ar || deleteTarget?.value}"</strong> نهائياً ولا يمكن التراجع عن هذه العملية.
          </div>
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}
            testId="roles__delete-dialog__cancel">
            إلغاء
          </Button>
          <Button variant="danger" onClick={confirmDelete} loading={deleteLoading}
            testId="roles__delete-dialog__confirm">
            حذف نهائي
          </Button>
        </Dialog.Footer>
      </Dialog>
    </div>
  );
}
