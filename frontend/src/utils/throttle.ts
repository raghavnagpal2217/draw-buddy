// ============================================================================
// Generic throttle/debounce. Used to cap Socket.IO emit frequency during
// continuous events (dragging, resizing, cursor movement) so we send a
// bounded number of messages per second instead of one per animation frame.
// ============================================================================

export function throttle<T extends (...args: any[]) => void>(fn: T, limitMs: number): T {
  let lastCall = 0;
  let pendingArgs: any[] | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const invoke = (args: any[]) => {
    lastCall = Date.now();
    fn(...args);
  };

  return ((...args: any[]) => {
    const now = Date.now();
    const remaining = limitMs - (now - lastCall);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      invoke(args);
    } else {
      // Always keep the LATEST args so the final call in a burst still
      // lands (important for "shape settled at final position").
      pendingArgs = args;
      if (!timeout) {
        timeout = setTimeout(() => {
          timeout = null;
          if (pendingArgs) invoke(pendingArgs);
        }, remaining);
      }
    }
  }) as T;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delayMs: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delayMs);
  }) as T;
}
