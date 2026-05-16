/**
 * Shared inline-style objects for the ChartsApp shell and its parts.
 *
 * Extracted from ChartsApp.jsx so the same look applies across the
 * sub-components without each importing the parent file.
 */

export const shellStyle = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: 'hsl(var(--background))',
};

export const headerStyle = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 8,
  padding: '12px 20px',
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  flexWrap: 'wrap',
};

export const mainStyle = { flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 };
export const canvasRowStyle = { flex: 1, display: 'flex', minHeight: 0, minWidth: 0 };

export const chartPersonBrowserStyle = {
  width: 260,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  padding: 12,
  borderInlineStart: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
};

export const chartToolbarStyle = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderTop: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  overflowX: 'auto',
};

export const chartOptionsPanelStyle = {
  position: 'absolute',
  right: 18,
  bottom: 58,
  zIndex: 30,
  width: 360,
  maxWidth: 'calc(100vw - 2rem)',
  maxHeight: 'min(620px, calc(100vh - 8rem))',
  overflow: 'auto',
  padding: 14,
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  boxShadow: '0 16px 40px rgba(0,0,0,0.28)',
};

export const relationshipControlsStyle = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 8,
  marginInlineEnd: 12,
};

export const relationshipToggleStyle = {
  minHeight: 34,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: 'hsl(var(--foreground))',
  font: '13px -apple-system, system-ui, sans-serif',
  whiteSpace: 'nowrap',
};

export const selectStyle = {
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  padding: '8px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
  cursor: 'pointer',
};

export const popoverStyle = {
  position: 'absolute',
  insetInlineEnd: 0,
  top: 'calc(100% + 6px)',
  width: 380,
  maxWidth: 'calc(100vw - 24px)',
  maxHeight: '70vh',
  overflowY: 'auto',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 10,
  padding: 14,
  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
  zIndex: 20,
};

// Tab strip inside the chart "More" popover. Switches which option group is
// visible so 14+ sections don't pile up in one column. Bottom-border tab style
// keeps the active state visible while taking less horizontal room than pills,
// so all six labels fit inside the popover at desktop width and degrade to a
// horizontal scroll only on the narrowest phones.
export const morePopoverTabs = {
  display: 'flex',
  gap: 2,
  marginBottom: 10,
  marginInline: -2,
  borderBottom: '1px solid hsl(var(--border))',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
};
export function morePopoverTab(active) {
  return {
    flex: '0 0 auto',
    padding: '7px 9px 8px',
    marginBottom: -1,
    fontSize: 12,
    fontWeight: 600,
    border: 'none',
    borderBottom: active ? '2px solid hsl(var(--primary))' : '2px solid transparent',
    background: 'transparent',
    color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

export const optionSelect = {
  width: '100%',
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '6px 8px',
  font: '12px -apple-system, system-ui, sans-serif',
  outline: 'none',
};

export const loadingStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'hsl(var(--muted-foreground))',
  background: 'hsl(var(--background))',
};
