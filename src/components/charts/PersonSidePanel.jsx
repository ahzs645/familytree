/**
 * Slide-in side panel that shows a read-only summary of a person
 * when you double-click their node in a chart.
 *
 * Keeps weight low — parents, spouses, children, a handful of events
 * and facts. For full editing, the "Open full editor" link jumps to
 * the PersonEditor route.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildPersonContext } from '../../lib/personContext.js';
import { lifeSpanLabel, Gender } from '../../models/index.js';

const GENDER_LABEL = {
  [Gender?.Male ?? 0]: 'Male',
  [Gender?.Female ?? 1]: 'Female',
  [Gender?.Unknown ?? 2]: 'Unknown',
  [Gender?.Intersex ?? 3]: 'Intersex',
};

export function PersonSidePanel({
  recordName,
  open,
  onClose,
  onReroot,
  width = 340,
}) {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!recordName) {
      setContext(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    buildPersonContext(recordName)
      .then((ctx) => { if (!cancelled) setContext(ctx); })
      .catch(() => { if (!cancelled) setContext(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [recordName]);

  const self = context?.selfSummary;
  const span = self ? lifeSpanLabel(self) : '';

  return (
    <aside
      aria-hidden={!open}
      style={{
        width: open ? width : 0,
        transition: 'width 220ms ease',
        overflow: 'hidden',
        borderInlineStart: open ? '1px solid hsl(var(--border))' : 'none',
        background: 'hsl(var(--card))',
        color: 'hsl(var(--foreground))',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div style={{ width, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <header style={headerStyle}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', letterSpacing: 0.4 }}>PERSON</div>
            <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {self?.fullName || (loading ? 'Loading…' : 'No person')}
            </div>
            {span && <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{span}</div>}
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close panel">✕</button>
        </header>

        <div style={bodyStyle}>
          {!self && !loading && (
            <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>Person not found.</div>
          )}

          {self && (
            <>
              <Section label="Details">
                <Row label="Gender" value={GENDER_LABEL[self.gender] || '—'} />
                <Row label="Born" value={formatDate(self.birthDate) || '—'} />
                <Row label="Died" value={formatDate(self.deathDate) || '—'} />
              </Section>

              {context.parents.length > 0 && (
                <Section label="Parents">
                  {context.parents.map((fam) => (
                    <div key={fam.family.recordName} style={{ marginBottom: 4 }}>
                      {fam.man && <PersonLine person={fam.man} onOpen={setOpenId} />}
                      {fam.woman && <PersonLine person={fam.woman} onOpen={setOpenId} />}
                    </div>
                  ))}
                </Section>
              )}

              {context.families.length > 0 && (
                <Section label={context.families.length > 1 ? 'Spouses & children' : 'Spouse & children'}>
                  {context.families.map((fam) => (
                    <div key={fam.family.recordName} style={{ marginBottom: 10 }}>
                      {fam.partner && <PersonLine person={fam.partner} onOpen={setOpenId} bold />}
                      {fam.children.length > 0 && (
                        <div style={{ marginInlineStart: 14, marginTop: 2 }}>
                          {fam.children.map((child) => (
                            <PersonLine key={child.recordName} person={child} onOpen={setOpenId} muted />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              {context.events.length > 0 && (
                <Section label="Events">
                  {context.events.slice(0, 8).map((ev) => (
                    <Row
                      key={ev.recordName}
                      label={readField(ev, 'eventType') || 'Event'}
                      value={readField(ev, 'date') || readField(ev, 'place') || ''}
                    />
                  ))}
                </Section>
              )}

              {context.facts.length > 0 && (
                <Section label="Facts">
                  {context.facts.slice(0, 6).map((ft) => (
                    <Row
                      key={ft.recordName}
                      label={readField(ft, 'factType') || 'Fact'}
                      value={readField(ft, 'value') || ''}
                    />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>

        {self && (
          <footer style={footerStyle}>
            <button onClick={() => onReroot && onReroot(self.recordName)} style={primaryBtn}>
              Re-root chart here
            </button>
            <Link to={`/person/${encodeURIComponent(self.recordName)}`} style={linkBtn}>
              Open full editor →
            </Link>
          </footer>
        )}
      </div>
    </aside>
  );

  function setOpenId() {
    // Placeholder — we don't allow in-panel navigation from this version.
    // The user can re-root and re-open if they want to inspect someone else.
  }
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11,
        letterSpacing: 0.4,
        color: 'hsl(var(--muted-foreground))',
        marginBottom: 6,
        textTransform: 'uppercase',
      }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, paddingBlock: 2, minWidth: 0 }}>
      <div style={{ color: 'hsl(var(--muted-foreground))', width: 80, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function PersonLine({ person, bold, muted }) {
  const span = lifeSpanLabel(person);
  return (
    <div style={{
      fontSize: 13,
      fontWeight: bold ? 600 : 400,
      color: muted ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
      paddingBlock: 2,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}>
      {person.fullName}
      {span && <span style={{ color: 'hsl(var(--muted-foreground))', marginInlineStart: 6 }}>{span}</span>}
    </div>
  );
}

function formatDate(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (raw.year) return String(raw.year);
  return '';
}

function readField(record, name) {
  const v = record?.fields?.[name]?.value;
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (v.value != null) return String(v.value);
  return '';
}

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '14px 16px',
  borderBottom: '1px solid hsl(var(--border))',
};
const bodyStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '14px 16px',
};
const footerStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 16px',
  borderTop: '1px solid hsl(var(--border))',
};
const closeBtnStyle = {
  background: 'transparent',
  color: 'hsl(var(--muted-foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  width: 28,
  height: 28,
  cursor: 'pointer',
  font: '13px -apple-system, system-ui, sans-serif',
};
const primaryBtn = {
  background: 'hsl(var(--primary))',
  color: 'hsl(var(--primary-foreground))',
  border: 'none',
  borderRadius: 6,
  padding: '8px 12px',
  font: '13px -apple-system, system-ui, sans-serif',
  cursor: 'pointer',
  fontWeight: 500,
};
const linkBtn = {
  textAlign: 'center',
  color: 'hsl(var(--primary))',
  font: '13px -apple-system, system-ui, sans-serif',
  textDecoration: 'none',
  padding: '6px 12px',
};

export default PersonSidePanel;
