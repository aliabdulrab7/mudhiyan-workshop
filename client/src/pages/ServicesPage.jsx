import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getServices, createService, updateService } from '../api/services';

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

  function handleShowForm() {
    setForm({ name: '', description: '', default_price: '' });
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        default_price: form.default_price !== '' ? Number(form.default_price) : undefined,
      };
      await createService(payload);
      setShowForm(false);
      setForm({ name: '', description: '', default_price: '' });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
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

  function handleCancelEdit() {
    setEditingId(null);
    setEditError('');
  }

  async function handleEditSubmit(e, id) {
    e.preventDefault();
    setEditSubmitting(true);
    setEditError('');
    try {
      const payload = {
        name: editForm.name,
        description: editForm.description || undefined,
        default_price: editForm.default_price !== '' ? Number(editForm.default_price) : undefined,
      };
      await updateService(id, payload);
      setEditingId(null);
      await load();
    } catch (e) {
      setEditError(e.message);
    } finally {
      setEditSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: '28px', maxWidth: '700px' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>قائمة الخدمات</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            إدارة خدمات الورشة والأسعار الافتراضية
          </p>
        </div>
        {!showForm && (
          <button className="btn-gold" onClick={handleShowForm}>✦ إضافة خدمة</button>
        )}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--gold-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              marginBottom: '32px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h2 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold)' }}>
              إضافة خدمة جديدة
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  اسم الخدمة
                </label>
                <input
                  className="input-base"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: تنظيف الذهب"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  الوصف
                </label>
                <input
                  className="input-base"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="وصف مختصر للخدمة (اختياري)"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  السعر الافتراضي (ريال)
                </label>
                <input
                  className="input-base"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.default_price}
                  onChange={e => setForm(f => ({ ...f, default_price: e.target.value }))}
                  placeholder="0.00"
                  style={{ fontFamily: 'JetBrains Mono, monospace', direction: 'ltr', textAlign: 'left' }}
                />
              </div>

              {error && (
                <div style={{ color: '#FCA5A5', fontSize: '0.88rem', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button className="btn-gold" type="submit" disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
                  {submitting ? '...' : '✦ حفظ'}
                </button>
                <button className="btn-ghost" type="button" onClick={() => { setShowForm(false); setError(''); }} style={{ flex: 0.5, justifyContent: 'center' }}>
                  إلغاء
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error outside form */}
      {error && !showForm && (
        <div style={{ color: '#FCA5A5', fontSize: '0.88rem', padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Services list */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '40px' }}>جاري التحميل...</div>
      ) : services.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--gold-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '60px 40px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.95rem',
        }}>
          لا توجد خدمات مسجلة
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <AnimatePresence>
            {services.map((service, idx) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--gold-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '18px 24px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                }}
              >
                {editingId === service.id ? (
                  /* Inline edit form */
                  <form onSubmit={e => handleEditSubmit(e, service.id)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        اسم الخدمة
                      </label>
                      <input
                        className="input-base"
                        value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        الوصف
                      </label>
                      <input
                        className="input-base"
                        value={editForm.description}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="اختياري"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        السعر الافتراضي (ريال)
                      </label>
                      <input
                        className="input-base"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.default_price}
                        onChange={e => setEditForm(f => ({ ...f, default_price: e.target.value }))}
                        style={{ fontFamily: 'JetBrains Mono, monospace', direction: 'ltr', textAlign: 'left' }}
                      />
                    </div>

                    {editError && (
                      <div style={{ color: '#FCA5A5', fontSize: '0.85rem', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)' }}>
                        {editError}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn-gold" type="submit" disabled={editSubmitting} style={{ flex: 1, justifyContent: 'center' }}>
                        {editSubmitting ? '...' : 'حفظ'}
                      </button>
                      <button className="btn-ghost" type="button" onClick={handleCancelEdit} style={{ flex: 0.5, justifyContent: 'center' }}>
                        إلغاء
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Read-only row */
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      {/* Service icon */}
                      <div style={{
                        width: '46px', height: '46px', borderRadius: '12px',
                        background: 'rgba(201,151,58,0.1)',
                        border: '1px solid var(--gold-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.3rem', color: 'var(--gold)', flexShrink: 0,
                      }}>
                        ✦
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                          {service.name}
                        </div>
                        {service.description && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {service.description}
                          </div>
                        )}
                        {service.default_price != null && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            السعر:{' '}
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--gold)' }}>
                              {service.default_price} ريال
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="btn-ghost-sm"
                      type="button"
                      onClick={() => handleStartEdit(service)}
                      style={{ padding: '6px 16px', flexShrink: 0 }}
                    >
                      تعديل
                    </motion.button>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
