import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { getStats, getOrders, getBranchStats } from '../api/orders';
import Button from '../components/ui/Button';
import { Icons } from '../components/icons';
import { useToast } from '../components/ToastProvider';

// The 10-status state machine in flow order.
// Lane width is proportional to item volume — widest lane = bottleneck.
const STAGES = [
  { id: 'received',         label: 'Received',          color: 'oklch(0.62 0.13 250)' },
  { id: 'inspection',       label: 'Inspection',         color: 'oklch(0.55 0.16 295)' },
  { id: 'waiting_approval', label: 'Waiting approval',   color: 'oklch(0.65 0.15 60)',  attn: true },
  { id: 'in_repair',        label: 'In repair',          color: 'oklch(0.60 0.13 220)' },
  { id: 'quality_check',    label: 'QC',                 color: 'oklch(0.55 0.08 260)' },
  { id: 'ready_for_return', label: 'Ready',              color: 'oklch(0.60 0.15 150)' },
  { id: 'returned_to_shop', label: 'At shop',            color: 'oklch(0.55 0.12 170)' },
  { id: 'delivered',        label: 'Delivered',          color: 'oklch(0.40 0.01 260)', muted: true },
];

// Which order statuses map to each stage id
const STATUS_MAP = {
  received:         ['received'],
  inspection:       ['inspection', 'diagnosing'],
  waiting_approval: ['waiting_approval', 'pending_approval'],
  in_repair:        ['in_repair', 'in_progress'],
  quality_check:    ['quality_check'],
  ready_for_return: ['ready_for_return', 'ready'],
  returned_to_shop: ['returned_to_shop'],
  delivered:        ['delivered', 'closed'],
};

// Static throughput placeholder — real API doesn't expose hourly data yet
const FLOW_DATA = [3, 5, 4, 7, 6, 8, 5, 9];
const FLOW_MAX  = Math.max(...FLOW_DATA);

export default function FlowPage() {
  const [stats,    setStats]          = useState(null);
  const [orders,   setOrders]         = useState([]);
  const [branches, setBranches]       = useState([]);
  const [branch,   setBranch]         = useState(null); // null = all
  const [loading,  setLoading]        = useState(true);
  const [refresh,  setRefresh]        = useState(0);
  const toast = useToast();

  useEffect(() => { document.title = 'The Flow | مضيان'; }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      getStats(),
      getOrders({ status: 'all', limit: 200 }),
      getBranchStats().catch(() => []),
    ]).then(([s, o, b]) => {
      if (!alive) return;
      setStats(s);
      setOrders(Array.isArray(o) ? o : []);
      setBranches(Array.isArray(b) ? b : []);
    }).catch(() => {
      if (alive) toast('Failed to load flow data', 'error');
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [refresh]);

  // Scope orders by selected branch
  const scoped = branch ? orders.filter(o => o.shop_id === branch) : orders;

  // Group by stage
  const byStage = {};
  for (const stage of STAGES) {
    byStage[stage.id] = scoped.filter(o => STATUS_MAP[stage.id].includes(o.status));
  }

  // Lane widths: min 10% share + proportional remainder
  const vols     = STAGES.map(s => byStage[s.id].length);
  const total    = vols.reduce((a, b) => a + b, 0) || 1;
  const maxVol   = Math.max(...vols) || 1;

  // Action queue — items needing a human decision
  const actionItems = [
    ...byStage.waiting_approval.map(o => ({
      urgent: !!o.is_urgent, cta: 'Review',
      title: `Approval pending — ${o.customer_name}`,
      meta:  `${o.order_number}`,
    })),
    ...byStage.received.filter(o => !o.technician_summary).map(o => ({
      urgent: false, cta: 'Assign',
      title: `Unassigned — ${o.customer_name}`,
      meta:  `${o.order_number} · needs technician`,
    })),
    ...scoped.filter(o => o.status === 'rejected').map(o => ({
      urgent: true, cta: 'Open',
      title: `Rejected — ${o.customer_name}`,
      meta:  o.order_number,
    })),
  ].slice(0, 10);

  const urgentCount  = actionItems.filter(a => a.urgent).length;
  const inSystem     = total - (byStage.delivered?.length ?? 0);
  const approvalCount = byStage.waiting_approval?.length ?? 0;

  const now = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-soft)', minHeight: 0 }}>

      {/* ── Header strip ── */}
      <div style={{ padding: '12px 20px 10px', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)' }}>{now}</div>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 2 }}>The Flow</div>
            </div>
            <div style={{ display: 'flex', gap: 20, paddingLeft: 20, borderLeft: '1px solid var(--border)', marginLeft: 4 }}>
              <SysStat label="In system"        value={loading ? '…' : inSystem}      sub="orders" />
              <SysStat label="Awaiting approval" value={loading ? '…' : approvalCount} sub="orders" warn={approvalCount > 0} />
              <SysStat label="Throughput"        value="9"                              sub="/ hr"   up />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {/* Branch scope filter */}
            {branches.length > 0 && (
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', fontSize: 11 }}>
                <BranchBtn label="All" active={branch === null} onClick={() => setBranch(null)} />
                {branches.map(b => (
                  <BranchBtn key={b.shop_id} label={b.shop_name} active={branch === b.shop_id} onClick={() => setBranch(b.shop_id)} />
                ))}
              </div>
            )}
            <Button size="sm" icon={<Icons.Refresh size={12} />} onClick={() => setRefresh(r => r + 1)} testId="flow__refresh">
              Refresh
            </Button>
            <Button as={NavLink} to="/" size="sm" variant="ghost" testId="flow__list-view">
              List view ↗
            </Button>
          </div>
        </div>
      </div>

      {/* ── Throughput strip ── */}
      <div style={{ padding: '7px 20px', background: '#fff', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', width: 100, flexShrink: 0 }}>
          Throughput · 8h
        </span>
        <div style={{ flex: 1, display: 'flex', gap: 4, height: 26, alignItems: 'flex-end' }}>
          {FLOW_DATA.map((v, i) => {
            const isNow = i === FLOW_DATA.length - 1;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
                <div style={{
                  width: '100%', height: `${(v / FLOW_MAX) * 18}px`,
                  background: isNow ? 'var(--primary)' : 'var(--border)',
                  borderRadius: '2px 2px 0 0',
                }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'var(--text-faint)' }}>
                  {isNow ? 'now' : `-${FLOW_DATA.length - 1 - i}h`}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Peak</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>9/hr</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--success)' }}>↑ 28%</span>
      </div>

      {/* ── Main body: lanes + action rail ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', minHeight: 0 }}>

        {/* Status lanes — horizontal river */}
        <div style={{ display: 'flex', overflow: 'auto', borderRight: '1px solid var(--border)' }}>
          {STAGES.map((stage, i) => {
            const items  = byStage[stage.id] ?? [];
            const vol    = vols[i];
            const pct    = Math.round((vol / maxVol) * 100);
            const isAttn = stage.attn;
            return (
              <div key={stage.id} style={{
                flex: `${Math.max(10 + (vol / total) * 90, 10)} 0 0`,
                minWidth: 105,
                display: 'flex', flexDirection: 'column',
                background: stage.muted ? 'transparent' : '#fff',
                borderRight: '1px solid var(--border)',
                opacity: stage.muted ? 0.5 : 1,
              }}>
                {/* Lane header */}
                <div style={{
                  padding: '8px 9px', borderBottom: '1px solid var(--border)',
                  background: isAttn ? 'oklch(0.95 0.025 60)' : 'var(--bg-soft)',
                  flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 8.5, textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      color: isAttn ? 'oklch(0.38 0.10 60)' : 'var(--text-muted)',
                    }}>{stage.label}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                      color: isAttn ? 'oklch(0.38 0.10 60)' : stage.color,
                    }}>{loading ? '…' : vol}</span>
                  </div>
                  <div style={{ marginTop: 4, height: 2, background: 'var(--border)', borderRadius: 1, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: stage.color, transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {/* Item ingots */}
                <div style={{ padding: 5, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden', flex: 1 }}>
                  {items.slice(0, 7).map(order => (
                    <div key={order.id} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px',
                      background: '#fff',
                      border: `1px solid ${order.is_urgent ? 'var(--primary)' : 'var(--border)'}`,
                      borderLeft: order.is_urgent ? '3px solid var(--primary)' : '1px solid var(--border)',
                      borderRadius: 3, cursor: 'pointer',
                    }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-faint)', flexShrink: 0 }}>
                        {order.order_number?.slice(-4)}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 500, flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {order.customer_name}
                      </span>
                    </div>
                  ))}
                  {items.length > 7 && (
                    <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-faint)', padding: 3 }}>
                      + {items.length - 7} more
                    </div>
                  )}
                  {items.length === 0 && !stage.muted && !loading && (
                    <div style={{
                      border: '1px dashed var(--border)', borderRadius: 3,
                      padding: 8, textAlign: 'center',
                      fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-faint)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>empty</div>
                  )}
                  {stage.muted && vol > 0 && (
                    <div style={{
                      padding: 8, textAlign: 'center',
                      fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-faint)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>locked · {vol} this week</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Action rail (your queue) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Your queue</span>
              {urgentCount > 0 && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 6px',
                  background: 'oklch(0.65 0.13 60)', color: '#fff', borderRadius: 999, fontWeight: 600,
                }}>{urgentCount} urgent</span>
              )}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-faint)' }}>{actionItems.length} total</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {actionItems.map((a, i) => (
              <div key={i} style={{
                padding: '10px 14px', borderBottom: '1px solid var(--border)',
                borderLeft: a.urgent ? '3px solid oklch(0.65 0.13 60)' : '3px solid transparent',
                background: a.urgent ? 'oklch(0.97 0.01 60)' : '#fff',
                display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.3 }}>{a.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>{a.meta}</span>
                  <NavLink to="/orders" style={{
                    padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 3,
                    fontSize: 11, color: 'var(--text)', fontWeight: 500, background: '#fff',
                    textDecoration: 'none', flexShrink: 0,
                  }}>{a.cta}</NavLink>
                </div>
              </div>
            ))}
            {actionItems.length === 0 && !loading && (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                All clear
              </div>
            )}
            {loading && (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>
                Loading…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SysStat({ label, value, sub, up, warn }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 2 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em',
          color: warn ? 'oklch(0.52 0.18 25)' : 'var(--text)',
        }}>{value}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>{sub}</span>
        {up && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--success)' }}>↑</span>}
      </div>
    </div>
  );
}

function BranchBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', border: 'none', cursor: 'pointer',
      fontFamily: 'var(--font-mono)', fontSize: 10.5,
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? '#fff' : 'var(--text)',
      borderLeft: '1px solid var(--border)',
    }}>{label}</button>
  );
}
