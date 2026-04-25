import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changeMyPassword } from '../api/settings';
import { clearAuth } from '../api/auth';
import Dialog from './ui/Dialog';
import Button from './ui/Button';

// Three-input password change form. Client-side validation (length + match)
// runs before the request; on validation failure focus jumps to the first
// invalid field. Wrong current password renders inline (not toast) — the
// user is mid-typing and may need to re-read the message.
//
// Success path is intentionally ordered so a back-button press cannot return
// to the authenticated app:
//   1. server returns 200 { ok, must_relogin }
//   2. navigate('/login', { replace: true }) — replaces history entry
//   3. clearAuth() in next tick (after navigate has committed)
//   4. login page reads location.state and fires the toast on mount
// JWT invalidation is client-side only — see CLAUDE.md.

export default function ChangePasswordDialog({ open, onClose }) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [currentError, setCurrentError] = useState('');
  const [nextError, setNextError]       = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentRef = useRef(null);
  const nextRef    = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setCurrentError('');
      setNextError('');
      setConfirmError('');
      setSubmitting(false);
    }
  }, [open]);

  function clearErrors() {
    setCurrentError('');
    setNextError('');
    setConfirmError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    clearErrors();

    if (!current) {
      setCurrentError('كلمة المرور الحالية مطلوبة');
      currentRef.current?.focus();
      return;
    }
    if (next.length < 8) {
      setNextError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل');
      nextRef.current?.focus();
      return;
    }
    if (next !== confirm) {
      setConfirmError('كلمتا المرور غير متطابقتين');
      confirmRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await changeMyPassword(current, next);
      navigate('/login', {
        replace: true,
        state: { reloginToast: 'كلمة المرور تم تغييرها — سجّل الدخول من جديد' },
      });
      setTimeout(() => clearAuth(), 0);
    } catch (err) {
      setSubmitting(false);
      if (err.code === 'wrong_current') {
        setCurrentError('كلمة المرور الحالية غير صحيحة');
        currentRef.current?.focus();
        currentRef.current?.select?.();
      } else {
        setCurrentError(err.message || 'فشل تغيير كلمة المرور');
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="تغيير كلمة المرور"
      size="sm"
      testId="change-password-dialog"
    >
      <form onSubmit={handleSubmit}>
        <Dialog.Body>
          <div className="flex flex-col gap-3">
            <div>
              <label className="field-label" htmlFor="cp-current">كلمة المرور الحالية</label>
              <input
                id="cp-current"
                ref={currentRef}
                type="password"
                className="input mono"
                value={current}
                onChange={(e) => { setCurrent(e.target.value); if (currentError) setCurrentError(''); }}
                autoComplete="current-password"
                data-testid="change-password-dialog__current"
                aria-invalid={!!currentError}
                aria-describedby={currentError ? 'cp-current-error' : undefined}
                style={{ direction: 'ltr', textAlign: 'left' }}
              />
              {currentError && (
                <div
                  id="cp-current-error"
                  data-testid="change-password-dialog__current-error"
                  className="text-[12px] mt-1"
                  style={{ color: 'var(--danger)' }}
                >
                  {currentError}
                </div>
              )}
            </div>
            <div>
              <label className="field-label" htmlFor="cp-new">كلمة المرور الجديدة</label>
              <input
                id="cp-new"
                ref={nextRef}
                type="password"
                className="input mono"
                value={next}
                onChange={(e) => { setNext(e.target.value); if (nextError) setNextError(''); }}
                autoComplete="new-password"
                data-testid="change-password-dialog__new"
                aria-invalid={!!nextError}
                aria-describedby={nextError ? 'cp-new-error' : undefined}
                style={{ direction: 'ltr', textAlign: 'left' }}
              />
              {nextError && (
                <div
                  id="cp-new-error"
                  data-testid="change-password-dialog__new-error"
                  className="text-[12px] mt-1"
                  style={{ color: 'var(--danger)' }}
                >
                  {nextError}
                </div>
              )}
            </div>
            <div>
              <label className="field-label" htmlFor="cp-confirm">تأكيد كلمة المرور الجديدة</label>
              <input
                id="cp-confirm"
                ref={confirmRef}
                type="password"
                className="input mono"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); if (confirmError) setConfirmError(''); }}
                autoComplete="new-password"
                data-testid="change-password-dialog__confirm"
                aria-invalid={!!confirmError}
                aria-describedby={confirmError ? 'cp-confirm-error' : undefined}
                style={{ direction: 'ltr', textAlign: 'left' }}
              />
              {confirmError && (
                <div
                  id="cp-confirm-error"
                  data-testid="change-password-dialog__confirm-error"
                  className="text-[12px] mt-1"
                  style={{ color: 'var(--danger)' }}
                >
                  {confirmError}
                </div>
              )}
            </div>
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            disabled={submitting}
            testId="change-password-dialog__cancel"
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={submitting}
            testId="change-password-dialog__submit"
          >
            حفظ
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog>
  );
}
