import { useEffect } from 'react';
import { Icons } from '../components/icons';

// Placeholder — real implementation comes in Phase 4.
export default function ControlTowerPage() {
  useEffect(() => { document.title = 'Control Tower | مضيان'; }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-faint)' }}>
        <Icons.Bolt size={40} style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
          Control Tower
        </div>
        <div style={{ fontSize: 13 }}>Coming in Phase 4.</div>
      </div>
    </div>
  );
}
