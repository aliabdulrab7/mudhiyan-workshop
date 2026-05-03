import { useEffect, useState } from 'react';
import { getSpecMap, updateSpecMapEntry } from '../api/technicians';
import { getSpecializations } from '../api/specializations';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Chip from '../components/ui/Chip';
import Dialog from '../components/ui/Dialog';

export default function SpecMapPage() {
  const [mapEntries, setMapEntries]   = useState([]);
  const [allSpecs, setAllSpecs]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  // Edit dialog state
  const [editingType, setEditingType] = useState(null); // item_type string | null
  const [selected, setSelected]       = useState([]);   // spec value keys
  const [saving, setSaving]           = useState(false);
  const [dialogError, setDialogError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [mapData, specsData] = await Promise.all([getSpecMap(), getSpecializations()]);
      setMapEntries(mapData.map ?? []);
      setAllSpecs(specsData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const specLookup = Object.fromEntries(allSpecs.map(s => [s.value, s.display_label_ar]));

  function openEdit(entry) {
    setEditingType(entry.item_type);
    setSelected(entry.spec_values ?? []);
    setDialogError('');
  }

  function toggleSpec(value) {
    setSelected(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  }

  async function handleSave() {
    setSaving(true);
    setDialogError('');
    try {
      const updated = await updateSpecMapEntry(editingType, selected);
      setMapEntries(prev =>
        prev.map(e => e.item_type === editingType
          ? { ...e, spec_values: updated.spec_values ?? selected, updated_at: updated.updated_at, updated_by_username: updated.updated_by_username }
          : e
        )
      );
      setEditingType(null);
    } catch (e) {
      setDialogError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const editingEntry = mapEntries.find(e => e.item_type === editingType) ?? null;

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">خريطة التخصصات</h1>
        <p className="page-sub">ربط أنواع القطع بالتخصصات المناسبة لها</p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>جارٍ التحميل…</div>
      ) : (
        <Card testId="spec-map-admin__list">
          {mapEntries.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>
              لا توجد بيانات
            </div>
          ) : (
            mapEntries.map((entry, i) => {
              const key = encodeURIComponent(entry.item_type);
              const isLast = i === mapEntries.length - 1;
              return (
                <div
                  key={entry.item_type}
                  data-testid={`spec-map-admin__entry--${key}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontWeight: 600, minWidth: 60 }}>{entry.item_type}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                    {(entry.spec_values ?? []).length === 0 ? (
                      <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>
                    ) : (
                      (entry.spec_values ?? []).map(v => (
                        <Chip key={v} size="sm" active>
                          {specLookup[v] ?? v}
                        </Chip>
                      ))
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    testId={`spec-map-admin__edit-btn--${key}`}
                    onClick={() => openEdit(entry)}
                  >
                    تعديل
                  </Button>
                </div>
              );
            })
          )}
        </Card>
      )}

      <Dialog
        open={editingType !== null}
        onClose={() => !saving && setEditingType(null)}
        testId="spec-map-admin__dialog"
        title={editingEntry ? `تعديل تخصصات ${editingEntry.item_type}` : 'تعديل'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 320 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {allSpecs.map(spec => (
              <Chip
                key={spec.value}
                size="md"
                active={selected.includes(spec.value)}
                data-active={selected.includes(spec.value) ? 'true' : 'false'}
                testId={`spec-map-admin__spec-chip--${spec.value}`}
                onClick={() => toggleSpec(spec.value)}
              >
                {spec.display_label_ar}
              </Chip>
            ))}
          </div>

          {dialogError && (
            <Alert variant="danger" testId="spec-map-admin__dialog-error">
              {dialogError}
            </Alert>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => setEditingType(null)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              testId="spec-map-admin__save-btn"
              onClick={handleSave}
            >
              حفظ
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
