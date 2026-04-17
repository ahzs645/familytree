/**
 * Right-pane focus view for a single person — parents / partners / children / events,
 * each as a clickable chip that re-focuses the pane. Summaries arrive from
 * buildPersonContext() already converted via models/wrap.js.
 */
import React from 'react';
import { Gender, lifeSpanLabel } from '../../models/index.js';

function genderLabel(g) {
  switch (g) {
    case Gender.Male:
      return 'Male';
    case Gender.Female:
      return 'Female';
    case Gender.Intersex:
      return 'Intersex';
    default:
      return 'Unknown';
  }
}

function Chip({ person, onPick }) {
  if (!person) return <div style={chipStyles(true)}>Unknown</div>;
  return (
    <div
      onClick={() => onPick(person.recordName)}
      style={chipStyles(false, person.gender)}
      onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.15)')}
      onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
    >
      <div style={{ fontSize: 13, color: '#e2e4eb', fontWeight: 600 }}>{person.fullName}</div>
      <div style={{ fontSize: 11, color: '#8b90a0' }}>{lifeSpanLabel(person)}</div>
    </div>
  );
}

function Section({ title, children, count }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={sectionHead}>
        {title} {count != null && <span style={{ color: '#5b6072', fontWeight: 400 }}>· {count}</span>}
      </div>
      {children}
    </div>
  );
}

export function PersonFocus({ context, onPick, onOpenAncestorChart, onOpenDescendantChart }) {
  if (!context) {
    return <div style={{ padding: 40, color: '#8b90a0' }}>Pick a person from the list.</div>;
  }
  const self = context.selfSummary;
  const parents = context.parents.flatMap((fam) => [fam.man, fam.woman]).filter(Boolean);
  const partners = context.families.map((f) => f.partner).filter(Boolean);
  const children = context.families.flatMap((f) => f.children).filter(Boolean);

  return (
    <div style={scroll}>
      <div style={headerBlock}>
        <div style={{ fontSize: 22, color: '#e2e4eb', fontWeight: 700 }}>{self.fullName}</div>
        <div style={{ fontSize: 13, color: '#8b90a0', marginTop: 4 }}>
          {lifeSpanLabel(self) || 'No life dates'} · {genderLabel(self.gender)}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button style={actionBtn} onClick={() => onOpenAncestorChart(self.recordName)}>Ancestor chart →</button>
          <button style={actionBtn} onClick={() => onOpenDescendantChart(self.recordName)}>Descendant chart →</button>
        </div>
      </div>

      <Section title="Parents" count={parents.length}>
        {parents.length === 0 ? (
          <div style={empty}>No parents recorded.</div>
        ) : (
          <div style={chipGrid}>{parents.map((p) => <Chip key={p.recordName} person={p} onPick={onPick} />)}</div>
        )}
      </Section>

      <Section title="Partners" count={partners.length}>
        {partners.length === 0 ? (
          <div style={empty}>No partners recorded.</div>
        ) : (
          <div style={chipGrid}>{partners.map((p) => <Chip key={p.recordName} person={p} onPick={onPick} />)}</div>
        )}
      </Section>

      <Section title="Children" count={children.length}>
        {children.length === 0 ? (
          <div style={empty}>No children recorded.</div>
        ) : (
          <div style={chipGrid}>{children.map((p) => <Chip key={p.recordName} person={p} onPick={onPick} />)}</div>
        )}
      </Section>

      <Section title="Events" count={context.events.length}>
        {context.events.length === 0 ? (
          <div style={empty}>No events recorded.</div>
        ) : (
          <table style={eventsTable}>
            <tbody>
              {context.events.map((e) => (
                <tr key={e.recordName}>
                  <td style={eventTypeCell}>{e.fields?.conclusionType?.value || e.fields?.eventType?.value || 'Event'}</td>
                  <td style={eventDateCell}>{e.fields?.date?.value || '—'}</td>
                  <td style={eventDescCell}>{e.fields?.description?.value || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function chipStyles(placeholder, gender) {
  const base = {
    padding: '10px 14px',
    borderRadius: 8,
    cursor: placeholder ? 'default' : 'pointer',
    minWidth: 160,
    transition: 'filter 0.15s',
  };
  if (placeholder) return { ...base, background: '#161922', border: '1px dashed #2e3345', color: '#5b6072' };
  const colors = {
    [Gender.Male]: ['#1c2a44', '#3b6db8'],
    [Gender.Female]: ['#3a1c33', '#b8417a'],
    [Gender.UnknownGender]: ['#1f2330', '#3a4054'],
    [Gender.Intersex]: ['#2a1f3a', '#7c5cb8'],
  };
  const [fill, stroke] = colors[gender] || colors[Gender.UnknownGender];
  return { ...base, background: fill, border: `1px solid ${stroke}` };
}

const scroll = { height: '100%', overflow: 'auto', padding: 28 };
const headerBlock = { paddingBottom: 20, borderBottom: '1px solid #2e3345', marginBottom: 24 };
const sectionHead = { color: '#e2e4eb', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 };
const chipGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 };
const empty = { color: '#5b6072', fontSize: 13, fontStyle: 'italic' };
const actionBtn = {
  background: '#242837',
  color: '#e2e4eb',
  border: '1px solid #2e3345',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
};
const eventsTable = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const eventTypeCell = { padding: '6px 0', color: '#e2e4eb', width: '28%' };
const eventDateCell = { padding: '6px 8px', color: '#8b90a0', width: '18%' };
const eventDescCell = { padding: '6px 0', color: '#8b90a0' };

export default PersonFocus;
