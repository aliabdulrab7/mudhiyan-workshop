import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { getTechnicians, getWorkloadSummary } from '../api/technicians';

// Lazy-fetch the workshop's technician roster the first time any consumer
// needs it (per-item dropdown, per-order dropdown, bulk dialog). Cached for
// the rest of the session. A failed fetch leaves status='error' and the
// next ensureLoaded() retries — the failure is never permanently cached.
// Mirrors the SettingsContext pattern.
//
// invalidate() resets the cache so the next ensureLoaded() refetches.
// Called from TechniciansPage / TechnicianDetailModal after any mutation
// (create / update / delete / specialization change) so assignment
// dropdowns elsewhere see the new roster on their next open.

const TechniciansCtx = createContext(null);

export function useTechnicians() {
  return useContext(TechniciansCtx);
}

export function TechniciansProvider({ children }) {
  const [technicians, setTechnicians] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState(null);
  const inFlight = useRef(null);

  // Workload summary — separate lazy fetch, same retry pattern.
  // workloadById: Map<techId, { status, active_count, urgent_count, current_item }>
  // workloadByName: Map<name, same> — best-effort name lookup for order-list rows
  const [workloadData, setWorkloadData] = useState(null); // null | array
  const [workloadStatus, setWorkloadStatus] = useState('idle');
  const workloadInFlight = useRef(null);

  const workloadById = useMemo(() => {
    if (!workloadData) return new Map();
    return new Map(workloadData.map(t => [t.id, t]));
  }, [workloadData]);

  const workloadByName = useMemo(() => {
    if (!workloadData) return new Map();
    return new Map(workloadData.map(t => [t.name, t]));
  }, [workloadData]);

  const ensureLoaded = useCallback(() => {
    // ensureLoaded must always return a thenable. The cache-hit path (`ready`)
    // used to return `inFlight.current`, which `.finally()` clears to null —
    // making `ensureLoaded().catch(...)` crash on the second call. Return a
    // resolved promise instead.
    if (status === 'ready') return Promise.resolve(technicians);
    if (status === 'loading' && inFlight.current) return inFlight.current;
    setStatus('loading');
    setError(null);
    const p = getTechnicians()
      .then((data) => {
        setTechnicians(data);
        setStatus('ready');
        return data;
      })
      .catch((err) => {
        setError(err);
        setStatus('error');
        throw err;
      })
      .finally(() => { inFlight.current = null; });
    inFlight.current = p;
    return p;
  }, [status, technicians]);

  const ensureWorkload = useCallback(() => {
    if (workloadStatus === 'ready') return Promise.resolve(workloadData);
    if (workloadStatus === 'loading' && workloadInFlight.current) return workloadInFlight.current;
    setWorkloadStatus('loading');
    const p = getWorkloadSummary()
      .then((data) => {
        setWorkloadData(data.technicians ?? []);
        setWorkloadStatus('ready');
        return data.technicians;
      })
      .catch(() => {
        setWorkloadStatus('error');
      })
      .finally(() => { workloadInFlight.current = null; });
    workloadInFlight.current = p;
    return p;
  }, [workloadStatus, workloadData]);

  const invalidateWorkload = useCallback(() => {
    workloadInFlight.current = null;
    setWorkloadData(null);
    setWorkloadStatus('idle');
  }, []);

  const invalidate = useCallback(() => {
    inFlight.current = null;
    setTechnicians(null);
    setStatus('idle');
    setError(null);
  }, []);

  return (
    <TechniciansCtx.Provider value={{
      technicians, status, error, ensureLoaded, invalidate,
      workloadById, workloadByName, workloadStatus, ensureWorkload, invalidateWorkload,
    }}>
      {children}
    </TechniciansCtx.Provider>
  );
}
