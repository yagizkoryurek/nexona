"use client";

import * as React from "react";

/** Long enough to read as work happening, short enough not to feel broken. */
const MOCK_LATENCY_MS = 900;

/**
 * Stands in for a network request until a backend exists.
 *
 * Deliberately resolves rather than hanging: an infinite spinner reads as a
 * bug, so every form settles into a state a reviewer can read. Swap the
 * `setTimeout` for the real call in the sprint that adds one.
 */
export function useMockSubmit() {
  const [pending, setPending] = React.useState(false);
  const [settled, setSettled] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guards against setting state after the form unmounts mid-flight.
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const submit = React.useCallback(() => {
    setPending(true);
    setSettled(false);

    timeoutRef.current = setTimeout(() => {
      setPending(false);
      setSettled(true);
    }, MOCK_LATENCY_MS);
  }, []);

  const reset = React.useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPending(false);
    setSettled(false);
  }, []);

  return { pending, settled, submit, reset };
}
