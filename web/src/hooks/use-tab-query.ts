import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

/**
 * Syncs tab state with the URL query string (?tab=...).
 * Supports fallback to defaultTab if the query param is absent or invalid.
 */
export function useTabQuery<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
  paramKey: string = 'tab'
): [T, (tab: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo<T>(() => {
    const raw = searchParams.get(paramKey);
    if (raw && (validTabs as readonly string[]).includes(raw)) {
      return raw as T;
    }
    return defaultTab;
  }, [searchParams, validTabs, defaultTab, paramKey]);

  const setActiveTab = useCallback(
    (tab: T) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === defaultTab) {
            next.delete(paramKey);
          } else {
            next.set(paramKey, tab);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams, defaultTab, paramKey]
  );

  return [activeTab, setActiveTab];
}
