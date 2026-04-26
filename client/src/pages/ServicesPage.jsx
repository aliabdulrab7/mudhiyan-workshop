import { useState, useEffect } from 'react';
import { getServices, createService, updateService } from '../api/services';
import { Icons } from '../components/icons';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import FormField from '../components/ui/FormField';
import Input from '../components/ui/Input';

export default function ServicesPage() {
  const [services, setServices]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [form, setForm]             = useState({ name: '', description: '', default_price: '' });
  const [editingId, setEditingId]   = useState(null);
  const [editForm, setEditForm]     = useState({ name: '', description: '', default_price: '' });
  const [editError, setEditError]   = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try { setServices(await getServices()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      await createService({
        name: form.name,
        description: form.description || undefined,
        default_price: form.default_price !== '' ? Number(form.default_price) : undefined,
      });
      setShowForm(false);
      setForm({ name: '', description: '', default_price: '' });
      await load();
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  function handleStartEdit(service) {
    setEditingId(service.id);
    setEditForm({
      name: service.name,
      description: service.description || '',
      default_price: service.default_price != null ? String(service.default_price) : '',
    });
    setEditError('');
  }

  async function handleEditSubmit(e, id) {
    e.preventDefault();
    setEditSubmitting(true); setEditError('');
    try {
      await updateService(id, {
        name: editForm.name,
        description: editForm.description || undefined,
        default_price: editForm.default_price !== '' ? Number(editForm.default_price) : undefined,
      });
      setEditingId(null);
      await load();
    } catch (e) { setEditError(e.message); }
    finally { setEditSubmitting(false); }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">قائمة الخدمات</h1>
          <div className="page-sub">إدارة خدمات الورشة والأسعار الافتراضية</div>
        </div>
        <div className="page-actions">
          {!showForm && (
            <Button
              variant="primary"
              size="sm"
              icon={<Icons.Plus size={12} />}
              onClick={() => { setForm({ name: '', description: '', default_price: '' }); setError(''); setShowForm(true); }}
              testId="services__add-button"
            >
              إضافة خدمة
            </Button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', maxWidth: 680 }}>
        {/* Create form */}
        {showForm && (
          <Card style={{ padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16 }}>إضافة خدمة جديدة</div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FormField label="اسم الخدمة">
                <Input value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: تنظيف الذهب" required autoFocus
                  testId="services__form__name-input" />
              </FormField>
              <FormField label="الوصف">
                <Input value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="وصف مختصر (اختياري)"
                  testId="services__form__description-input" />
              </FormField>
              <FormField label="السعر الافتراضي (ريال)">
                <Input mono type="number" min="0" step="0.01"
                  value={form.default_price}
                  onChange={e => setForm(f => ({ ...f, default_price: e.target.value }))}
                  placeholder="0.00"
                  testId="services__form__price-input" />
              </FormField>
              {error && <Alert variant="danger">{error}</Alert>}
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="primary" type="submit" loading={submitting} className="flex-1 justify-center" testId="services__form__submit">
                  {submitting ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
                <Button variant="ghost" type="button" onClick={() => { setShowForm(false); setError(''); }} testId="services__form__cancel">
                  إلغاء
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Error outside form */}
        {error && !showForm && (
          <div style={{ marginBottom: 12 }}>
            <Alert variant="danger">{error}</Alert>
          </div>
        )}

        {/* Services list */}
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, fontSize: 13 }}>جاري التحميل...</div>
        ) : services.length === 0 ? (
          <Card style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            لا توجد خدمات مسجلة
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {services.map(service => (
              <Card key={service.id} style={{ padding: '14px 18px' }}>
                {editingId === service.id ? (
                  <form onSubmit={e => handleEditSubmit(e, service.id)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <FormField label="اسم الخدمة">
                      <Input value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
                    </FormField>
                    <FormField label="الوصف">
                      <Input value={editForm.description}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="اختياري" />
                    </FormField>
                    <FormField label="السعر الافتراضي (ريال)">
                      <Input mono type="number" min="0" step="0.01"
                        value={editForm.default_price}
                        onChange={e => setEditForm(f => ({ ...f, default_price: e.target.value }))} />
                    </FormField>
                    {editError && <Alert variant="danger">{editError}</Alert>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="primary" type="submit" loading={editSubmitting} className="flex-1 justify-center" testId={`services__row__${service.id}__save`}>
                        {editSubmitting ? 'جاري الحفظ...' : 'حفظ'}
                      </Button>
                      <Button variant="ghost" type="button" onClick={() => setEditingId(null)} testId={`services__row__${service.id}__cancel`}>
                        إلغاء
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                      background: 'var(--primary-soft)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Icons.Tag size={16} stroke="var(--primary)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{service.name}</div>
                      {service.description && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{service.description}</div>
                      )}
                      {service.default_price != null && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          السعر: <span className="mono" style={{ color: 'var(--primary)' }}>{service.default_price} ريال</span>
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" type="button" onClick={() => handleStartEdit(service)} testId={`services__row__${service.id}__edit`}>
                      تعديل
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
