import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { getTechnicians } from '../api/technicians';

// Lazy-fetch the workshop's technician roster the first time any consumer
// needs it (per-item dropdown, per-order dropdown, bulk dialog). Cached for
// the rest of the session. A failed fetch leaves status='error' and the
// next ensureLoaded() retries — the failure is never permanently cached.
// Mirrors the SettingsContext pattern.

const TechniciansCtx = createContext(null);

export function useTechnicians() {
  return useContext(TechniciansCtx);
}

export function TechniciansProvider({ children }) {
  const [technicians, setTechnicians] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState(null);
  const inFlight = useRef(null);

  const ensureLoaded = useCallback(() => {
    if (status === 'loading' || status === 'ready') return inFlight.current;
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
  }, [status]);

  return (
    <TechniciansCtx.Provider value={{ technicians, status, error, ensureLoaded }}>
      {children}
    </TechniciansCtx.Provider>
  );
}
