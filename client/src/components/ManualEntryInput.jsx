import { useEffect, useRef, useState } from 'react';
import { Icons } from './icons';

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
      <input
        ref={inputRef}
        className="input mono"
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="BR1-20260420-0022"
        autoComplete="off"
        spellCheck={false}
        style={{ direction: 'ltr', textAlign: 'left', fontSize: 14 }}
      />
      <div>
        <button
          type="submit"
          className="btn btn-sm btn-primary"
          disabled={!value.trim()}
        >
          <Icons.Arrow size={12} /> بحث
        </button>
      </div>
    </form>
  );
}
