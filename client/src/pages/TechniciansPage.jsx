import { useEffect, useState } from 'react';
import { listTechnicians, archiveTechnician, restoreTechnician, getTechRefCount } from '../api/technicians';
import { getRoles } from '../api/roles';
import { useTechnicians } from '../contexts/TechniciansContext';
import { Icons } from '../components/icons';
import ArchiveConfirmDialog from '../components/ArchiveConfirmDialog';
import TechnicianDetailModal from '../components/TechnicianDetailModal';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Chip from '../components/ui/Chip';
import Input from '../components/ui/Input';
import { useToast } from '../components/ToastProvider';

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: 'available', label: 'متاح',         dot: 'var(--success)' },
  { value: 'busy',      label: 'مشغول',        dot: 'var(--warning)' },
  { value: 'off_shift', label: 'خارج الدوام', dot: 'var(--text-faint)' },
  { value: 'on_leave',  label: 'في إجازة',     dot: 'var(--danger)' },
];

const STATUS_DOT   = Object.fromEntries(STATUS_FILTERS.map((s) => [s.value, s.dot]));
const STATUS_LABEL = Object.fromEntries(STATUS_FILTERS.map((s) => [s.value, s.label]));

const ACTIVE_FILTERS = [
  { value: 'all',      label: 'الكل' },
  { value: 'active',   label: 'فعّال' },
  { value: 'inactive', label: 'موقوف' },
];

export default function TechniciansPage() {
  const techCtx = useTechnicians();
  const toast   = useToast();

  const [searchInput, setSearchInput]   = useState('');
  const [search, setSearch]             = useState('');
  const [roleFilter, setRoleFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage]                 = useState(0);

  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [roles, setRoles]     = useState([]);
  const [reloadTick, setReloadTick] = useState(0);

  const [modalOpen, setModalOpen]   = useState(false);
  const [modalMode, setModalMode]   = useState('create');
  const [modalTechId, setModalTechId] = useState(null);

  const [archiveTarget, setArchiveTarget]         = useState(null);
  const [archiveConfirming, setArchiveConfirming] = useState(false);

  useEffect(() => { document.title = 'الفنيون | مضيان'; }, []);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    async function loadRoles() {
      try {
        const r = await getRoles();
        setRoles(Array.isArray(r) ? r.filter((x) => x.active !== 0) : []);
      } catch { /* filter chips stay empty */ }
    }
    loadRoles();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadList() {
      setLoading(true);
      setError('');
      const params = {
        search:           search || undefined,
        role_id:          roleFilter || undefined,
        status:           statusFilter || undefined,
        include_archived: showArchived,
        limit:            PAGE_SIZE,
        offset:           page * PAGE_SIZE,
      };
      if (activeFilter === 'active')   params.active = 1;
      if (activeFilter === 'inactive') params.active = 0;
      try {
        const data = await listTechnicians(params);
        if (cancelled) return;
        setItems(data.items ?? []);
        setTotal(data.total ?? (data.items?.length ?? 0));
      } catch (e) {
        if (!cancelled) setError(e.message || 'فشل تحميل الفنيين');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadList();
    return () => { cancelled = true; };
  }, [search, roleFilter, statusFilter, activeFilter, showArchived, page, reloadTick]);

  function openCreate() { setModalMode('create'); setModalTechId(null); setModalOpen(true); }
  function openEdit(t)  { setModalMode('edit');   setModalTechId(t.id);  setModalOpen(true); }

  function handleSaved() {
    techCtx?.invalidate?.();
    setPage(0);
    setReloadTick((n) => n + 1);
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchiveConfirming(true);
    try {
      await archiveTechnician(archiveTarget.id);
      setArchiveTarget(null);
      techCtx?.invalidate?.();
      setReloadTick((n) => n + 1);
    } catch (e) {
      toast?.(e.message, 'error');
    } finally {
      setArchiveConfirming(false);
    }
  }

  async function handleRestore(t) {
    try {
      await restoreTechnician(t.id);
      techCtx?.invalidate?.();
      setReloadTick((n) => n + 1);
    } catch (e) {
      toast?.(e.message, 'error');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const roleNameFor = (id) => {
    const r = roles.find((x) => x.id === id);
    return r ? (r.display_label_ar || r.value) : null;
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">الفنيون</h1>
          <div className="page-sub">إدارة فنيي الورشة وأدوارهم وتخصصاتهم</div>
        </div>
        <div className="page-actions">
          <Button variant="primary" size="sm" icon={<Icons.Plus size={12} />} onClick={openCreate}
            testId="technicians__add-button">
            إضافة فني
          </Button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Search + filters */}
        <Card style={{ padding: '14px 16px', marginBottom: 12 }}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Icons.Search size={14} stroke="var(--text-muted)" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ابحث بالاسم أو الجوال أو الملاحظات..."
                testId="technicians__search-input"
              />
            </div>

            {/* Status chips */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-faint ml-1">الحالة:</span>
              <Chip active={statusFilter === ''} onClick={() => { setStatusFilter(''); setPage(0); }}
                testId="technicians__filter__status__all">الكل</Chip>
              {STATUS_FILTERS.map((s) => (
                <Chip key={s.value} active={statusFilter === s.value}
                  onClick={() => { setStatusFilter(statusFilter === s.value ? '' : s.value); setPage(0); }}
                  testId={`technicians__filter__status__${s.value}`}>
                  {s.label}
                </Chip>
              ))}
            </div>

            {/* Role chips */}
            {roles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-faint ml-1">الدور:</span>
                <Chip active={roleFilter === ''} onClick={() => { setRoleFilter(''); setPage(0); }}
                  testId="technicians__filter__role__all">الكل</Chip>
                {roles.map((r) => (
                  <Chip key={r.id} active={roleFilter === String(r.id)}
                    onClick={() => { setRoleFilter(roleFilter === String(r.id) ? '' : String(r.id)); setPage(0); }}
                    testId={`technicians__filter__role__${r.value}`}>
                    {r.display_label_ar || r.value}
                  </Chip>
                ))}
              </div>
            )}

            {/* Active toggle */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-faint ml-1">الإيقاف:</span>
              {ACTIVE_FILTERS.map((a) => (
                <Chip key={a.value} active={activeFilter === a.value}
                  onClick={() => { setActiveFilter(a.value); setPage(0); }}
                  testId={`technicians__filter__active__${a.value}`}>
                  {a.label}
                </Chip>
              ))}
            </div>

            {/* Archive toggle */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-faint ml-1">الأرشيف:</span>
              <Chip active={!showArchived}
                onClick={() => { setShowArchived(false); setPage(0); }}
                testId="technicians__filter__archived__no">
                الحاليون
              </Chip>
              <Chip active={showArchived}
                onClick={() => { setShowArchived(true); setPage(0); }}
                testId="technicians__filter__archived__yes">
                المؤرشفون
              </Chip>
            </div>
          </div>
        </Card>

        {error && (
          <div style={{ marginBottom: 12 }}>
            <Alert variant="danger">{error}</Alert>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="skeleton" style={{ width: 120, height: 13 }} />
                  <div className="skeleton" style={{ width: 80, height: 11 }} />
                </div>
                <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 999 }} />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            {showArchived ? 'لا يوجد فنيون مؤرشفون' : 'لا يوجد فنيون مطابقون لهذه التصفية'}
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {items.map((t) => {
                const specsArr  = t.specializations_top3 || t.specializations || [];
                const specs     = specsArr.slice(0, 3);
                const moreSpecs = Math.max(0, (specsArr.length || 0) - 3);
                const roleLabel = t.role_display_label_ar || t.role_value || roleNameFor(t.role_id);
                const isArchived = !!t.archived_at;
                return (
                  <Card
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      opacity: (t.active === 0 || isArchived) ? 0.6 : 1,
                    }}
                    testId={`technicians__row__${t.id}`}
                  >
                    {/* Main clickable zone */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openEdit(t)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(t); } }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 18px',
                        cursor: 'pointer',
                        minWidth: 0,
                        textAlign: 'start',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                        background: isArchived ? 'var(--bg-soft)' : 'var(--primary-soft)',
                        border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Icons.User size={16} stroke={isArchived ? 'var(--text-faint)' : 'var(--primary)'} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{t.name || `#${t.id}`}</span>
                          {roleLabel && (
                            <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-sm"
                              style={{ background: 'var(--primary-soft)', color: 'var(--primary)', border: '1px solid var(--border)' }}>
                              {roleLabel}
                            </span>
                          )}
                          {isArchived && (
                            <span className="text-[10.5px] uppercase tracking-[0.06em]"
                              style={{ color: 'var(--text-faint)', background: 'var(--bg-soft)', padding: '1px 5px', borderRadius: 3 }}>
                              مؤرشف
                            </span>
                          )}
                          {!isArchived && t.active === 0 && (
                            <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-faint">موقوف</span>
                          )}
                        </div>

                        {(specs.length > 0 || t.phone) && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            {specs.map((s) => (
                              <span key={s.id} className="text-[10.5px] px-1.5 py-0.5 rounded-sm"
                                style={{ background: 'var(--bg-soft)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                {s.display_label_ar || s.value}
                              </span>
                            ))}
                            {moreSpecs > 0 && <span className="text-[10.5px] text-text-faint">+{moreSpecs}</span>}
                            {t.phone && <span className="font-mono text-[11px] text-text-faint" dir="ltr">{t.phone}</span>}
                          </div>
                        )}
                      </div>

                      {/* Status dot */}
                      {!isArchived && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span aria-label={STATUS_LABEL[t.status] || t.status} title={STATUS_LABEL[t.status] || t.status}
                            style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_DOT[t.status] || 'var(--text-faint)', flexShrink: 0 }} />
                          <span className="text-[11px] text-text-muted">{STATUS_LABEL[t.status] || ''}</span>
                        </div>
                      )}

                      {/* Workload */}
                      {!isArchived && (
                        <div className="flex-shrink-0 text-end" style={{ minWidth: 56 }}>
                          <div className="font-mono text-sm text-text">{t.active_count ?? 0}</div>
                          <div className="text-[10px] text-text-faint">قطعة نشطة</div>
                        </div>
                      )}
                    </div>

                    {/* Archive / Restore action */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      paddingInlineEnd: 12,
                      borderInlineStart: '1px solid var(--border-faint, var(--border))',
                      paddingInlineStart: 8,
                    }}>
                      {isArchived ? (
                        <Button variant="ghost" size="sm" onClick={() => handleRestore(t)}
                          testId={`technicians__row__${t.id}__restore`}>
                          استعادة
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(t)}
                          testId={`technicians__row__${t.id}__archive`}>
                          أرشفة
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <Button variant="ghost" size="sm" disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  testId="technicians__pagination__prev">
                  السابق
                </Button>
                <div className="text-xs text-text-muted">
                  صفحة <span className="font-mono">{page + 1}</span> من <span className="font-mono">{totalPages}</span>
                  {' · '}<span className="font-mono">{total}</span> فني
                </div>
                <Button variant="ghost" size="sm" disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  testId="technicians__pagination__next">
                  التالي
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <TechnicianDetailModal
        open={modalOpen}
        mode={modalMode}
        techId={modalTechId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <ArchiveConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={confirmArchive}
        entityLabel="الفني"
        fetchRefCount={() => getTechRefCount(archiveTarget?.id)}
        confirming={archiveConfirming}
      />
    </div>
  );
}
