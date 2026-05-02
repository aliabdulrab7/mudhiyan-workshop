import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { getMySettings, patchMySettings } from '../api/settings';
import { useToast } from '../components/ToastProvider';

// Lazy: nothing fetches until ensureLoaded() is called (first menu open).
// Retry: a failed fetch leaves status='error', and the next ensureLoaded()
// retries — the failure is never permanently cached.
// Optimistic: updateSetting() flips local state first, PATCHes the server,
// reverts + toasts on failure, and re-syncs to the server's response on
// success (server is authoritative for shape).

const SettingsCtx = createContext(null);

export function useSettings() {
  return useContext(SettingsCtx);
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState(null);
  const inFlight = useRef(null);
  const toast = useToast();

  const ensureLoaded = useCallback(() => {
    // ensureLoaded must always return a thenable. The cache-hit path (`ready`)
    // used to return `inFlight.current`, which `.finally()` clears to null —
    // making `ensureLoaded().catch(...)` crash on the second call.
    if (status === 'ready') return Promise.resolve(settings);
    if (status === 'loading' && inFlight.current) return inFlight.current;
    setStatus('loading');
    setError(null);
    const p = getMySettings()
      .then((data) => {
        setSettings(data);
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
  }, [status, settings]);

  const updateSetting = useCallback(async (key, value) => {
    const prev = settings ? settings[key] : undefined;
    setSettings((s) => ({ ...(s || {}), [key]: value }));
    try {
      const updated = await patchMySettings({ [key]: value });
      setSettings(updated);
      return updated;
    } catch (err) {
      setSettings((s) => ({ ...(s || {}), [key]: prev }));
      toast?.(err.message || 'فشل حفظ الإعداد', 'error');
      throw err;
    }
  }, [settings, toast]);

  return (
    <SettingsCtx.Provider value={{ settings, status, error, ensureLoaded, updateSetting }}>
      {children}
    </SettingsCtx.Provider>
  );
}
