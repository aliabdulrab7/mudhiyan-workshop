import { useEffect, useRef, useCallback } from 'react';
import { getOrders } from '../api/orders';
import { getRole } from '../api/auth';

const POLL_MS = 30_000;

export function useApprovalNotifications(onApproved) {
  const prevMap   = useRef(new Map()); // id → { status, order_number, customer_name }
  const initialized = useRef(false);
  const onApprovedRef = useRef(onApproved);
  onApprovedRef.current = onApproved;

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (getRole() !== 'workshop') return;

    requestPermission();

    async function poll() {
      try {
        const orders = await getOrders();
        const current = new Map(orders.map(o => [o.id, o]));

        if (initialized.current) {
          for (const [id, prev] of prevMap.current) {
            const curr = current.get(id);
            if (prev.status === 'pending_approval' && curr?.status === 'in_progress') {
              // Customer approved — fire browser notification
              if (Notification.permission === 'granted') {
                new Notification('موافقة عميل جديدة', {
                  body: `وافق ${prev.customer_name} على طلب ${prev.order_number}`,
                  icon: '/favicon.svg',
                });
              }
              onApprovedRef.current?.(curr);
            }
          }
        }

        prevMap.current = current;
        initialized.current = true;
      } catch {
        // network error — ignore, retry next interval
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, []);
}
