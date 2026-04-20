/**
 * Promise-based replacement for window.alert/confirm/prompt.
 * Styling mirrors SchemaMigrationSheet so every modal in the app
 * looks like it belongs to the same design system.
 *
 * Usage:
 *   const modal = useModal();
 *   await modal.alert('Saved.');
 *   modal.toast('Saved.');
 *   if (!(await modal.confirm('Delete?'))) return;
 *   const name = await modal.prompt('Rename:', existing);
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ModalContext = createContext(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within <ModalProvider>');
  return ctx;
}

export function ModalProvider({ children }) {
  const [stack, setStack] = useState([]);
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const toastIdRef = useRef(0);

  const push = useCallback((modal) => {
    const id = ++idRef.current;
    return new Promise((resolve) => {
      setStack((s) => [...s, { ...modal, id, resolve }]);
    });
  }, []);

  const close = useCallback((id, value) => {
    setStack((s) => {
      const m = s.find((x) => x.id === id);
      if (m) m.resolve(value);
      return s.filter((x) => x.id !== id);
    });
  }, []);

  const closeToast = useCallback((id) => {
    setToasts((s) => s.filter((x) => x.id !== id));
  }, []);

  const api = useMemo(() => ({
    alert: (message, opts = {}) =>
      push({ kind: 'alert', message, title: opts.title, okLabel: opts.okLabel }),
    confirm: (message, opts = {}) =>
      push({
        kind: 'confirm',
        message,
        title: opts.title,
        okLabel: opts.okLabel,
        cancelLabel: opts.cancelLabel,
        destructive: !!opts.destructive,
      }),
    prompt: (message, defaultValue = '', opts = {}) =>
      push({
        kind: 'prompt',
        message,
        defaultValue,
        title: opts.title,
        okLabel: opts.okLabel,
        cancelLabel: opts.cancelLabel,
        placeholder: opts.placeholder,
        multiline: !!opts.multiline,
      }),
    toast: (message, opts = {}) => {
      const id = ++toastIdRef.current;
      setToasts((s) => [
        ...s,
        {
          id,
          message,
          title: opts.title,
          kind: opts.kind || 'default',
          duration: opts.duration ?? 4500,
        },
      ]);
      return id;
    },
  }), [push]);

  return (
    <ModalContext.Provider value={api}>
      {children}
      {stack.map((m) => (
        <ModalView key={m.id} modal={m} onClose={(v) => close(m.id, v)} />
      ))}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto z-[80] flex flex-col items-stretch sm:items-end gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} onClose={() => closeToast(toast.id)} />
        ))}
      </div>
    </ModalContext.Provider>
  );
}

function ToastView({ toast, onClose }) {
  useEffect(() => {
    if (!Number.isFinite(toast.duration) || toast.duration <= 0) return undefined;
    const t = setTimeout(onClose, toast.duration);
    return () => clearTimeout(t);
  }, [onClose, toast.duration]);

  const accentClass = toast.kind === 'success'
    ? 'border-l-primary'
    : toast.kind === 'error'
      ? 'border-l-destructive'
      : 'border-l-muted-foreground';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto w-full sm:w-96 rounded-lg border border-border border-l-4 ${accentClass} bg-card px-4 py-3 shadow-lg`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {toast.title && (
            <div className="text-sm font-semibold text-foreground leading-5">{toast.title}</div>
          )}
          <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-5">
            {toast.message}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          x
        </button>
      </div>
    </div>
  );
}

function ModalView({ modal, onClose }) {
  const inputRef = useRef(null);
  const okRef = useRef(null);
  const [value, setValue] = useState(modal.kind === 'prompt' ? (modal.defaultValue ?? '') : '');

  useEffect(() => {
    const t = setTimeout(() => {
      if (modal.kind === 'prompt') {
        inputRef.current?.focus();
        inputRef.current?.select?.();
      } else {
        okRef.current?.focus();
      }
    }, 0);
    return () => clearTimeout(t);
  }, [modal.kind]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = () => {
    if (modal.kind === 'alert') onClose(undefined);
    else if (modal.kind === 'confirm') onClose(false);
    else onClose(null);
  };

  const accept = () => {
    if (modal.kind === 'alert') onClose(undefined);
    else if (modal.kind === 'confirm') onClose(true);
    else onClose(value);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    accept();
  };

  const title =
    modal.title ||
    (modal.kind === 'alert' ? 'Notice' : modal.kind === 'confirm' ? 'Confirm' : 'Input required');
  const okLabel = modal.okLabel || (modal.kind === 'confirm' ? 'Continue' : 'OK');
  const cancelLabel = modal.cancelLabel || 'Cancel';

  const okClass = modal.destructive
    ? 'text-sm bg-destructive text-destructive-foreground rounded-md px-3 py-1.5'
    : 'text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <form
        onSubmit={onSubmit}
        className="bg-card border border-border rounded-xl w-full max-w-md shadow-lg"
      >
        <header className="px-5 py-3 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
        </header>
        <main className="px-5 py-4 space-y-3 text-sm">
          <p className="text-foreground whitespace-pre-wrap leading-relaxed">{modal.message}</p>
          {modal.kind === 'prompt' && (
            modal.multiline ? (
              <textarea
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={modal.placeholder || ''}
                rows={4}
                className="w-full bg-secondary border border-border rounded-md px-2.5 py-1.5 text-sm"
              />
            ) : (
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={modal.placeholder || ''}
                className="w-full bg-secondary border border-border rounded-md px-2.5 py-1.5 text-sm"
              />
            )
          )}
        </main>
        <footer className="px-5 py-3 border-t border-border flex gap-2 justify-end">
          {modal.kind !== 'alert' && (
            <button
              type="button"
              onClick={cancel}
              className="text-sm border border-border bg-secondary rounded-md px-3 py-1.5"
            >
              {cancelLabel}
            </button>
          )}
          <button ref={okRef} type="submit" className={okClass}>
            {okLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}

export default ModalProvider;
