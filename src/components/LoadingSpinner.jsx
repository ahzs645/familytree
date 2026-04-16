/**
 * LoadingSpinner — animated loading indicator.
 * Was `oe()` in the minified code.
 */
export function LoadingSpinner() {
  return (
    <div className="spinner">
      <div />
    </div>
  );
}

/**
 * LoadingPage — full-page loading state with centered spinner.
 * Was `da()` in the minified code.
 */
export function LoadingPage() {
  return (
    <div className="loading-page">
      <LoadingSpinner />
    </div>
  );
}

/**
 * InterfaceBlocker — full-screen overlay with spinner to block interaction during async ops.
 * Was `pa(props)` in the minified code.
 */
export function InterfaceBlocker({ blockUserInterface }) {
  if (!blockUserInterface) return null;
  return (
    <div className="block-user-interface-backdrop">
      <LoadingSpinner />
    </div>
  );
}

export default LoadingSpinner;
