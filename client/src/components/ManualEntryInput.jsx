import { useEffect, useRef, useState } from 'react';
import { Icons } from './icons';
import Button from './ui/Button';
import Input from './ui/Input';

export default function ManualEntryInput({ onSubmit }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        أدخل رقم الطلب
      </div>
      <Input
        ref={inputRef}
        mono
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="BR1-20260420-0022"
        autoComplete="off"
        spellCheck={false}
        style={{ fontSize: 14 }}
        testId="manual-entry__input"
      />
      <div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          icon={<Icons.Arrow size={12} />}
          disabled={!value.trim()}
          testId="manual-entry__submit"
        >
          بحث
        </Button>
      </div>
    </form>
  );
}
