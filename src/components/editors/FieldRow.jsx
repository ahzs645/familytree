/**
 * Labeled field used by every editor. Accepts any child input-like element.
 */
import React from 'react';

export function FieldRow({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: '#8b90a0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 5 }}>
        {label}
      </div>
      {children}
      {hint && <div style={{ color: '#5b6072', fontSize: 11, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export const editorInput = {
  width: '100%',
  background: '#1a1d27',
  color: '#e2e4eb',
  border: '1px solid #2e3345',
  borderRadius: 6,
  padding: '8px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
};

export const editorTextarea = {
  ...editorInput,
  minHeight: 80,
  resize: 'vertical',
  fontFamily: 'inherit',
};

export default FieldRow;
