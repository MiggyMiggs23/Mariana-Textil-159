import { useEffect, useState } from "react";

/**
 * Returns a value only after it remains unchanged for the requested delay.
 * Used by inventory searches to avoid issuing a query on every keystroke.
 */
export function useDebounce<T>(value: T, delay = 250): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debouncedValue;
}