import React from 'react';
import { Gender, lifeSpanLabel } from '../../models/index.js';
import { useIsMobile } from '../../lib/useIsMobile.js';

export function FamilyTreeView({ model, activeId, loading, onPick, onEditPerson, onOpenFamily }) {
  const isMobile = useIsMobile();
  if (loading) return <div style={empty}>Loading family tree...</div>;
  if (!model) return <div style={empty}>Pick a person to view their family tree.</div>;

  const hasParents = model.parents.length > 0;
  const hasSpouses = model.spouses.length > 0;
  const hasChildren = model.children.length > 0;
  const canvasStyle = isMobile ? canvasMobile : canvas;
  const middleGridStyle = isMobile ? middleGridMobile : middleGrid;

  return (
    <div style={workspace}>
      <div style={canvasStyle}>
        <FamilyBand title="Parents" emptyText="No parents recorded." people={model.parents} onPick={onPick} />

        <Connector visible={hasParents || model.siblings.length > 1} />

        <div style={middleGridStyle}>
          <FamilyPanel title="Siblings">
            <div style={siblingRow}>
              {model.siblings.map((person) => (
                <PersonNode
                  key={person.recordName}
                  person={person}
                  active={person.recordName === activeId}
                  onPick={onPick}
                  onEditPerson={onEditPerson}
                />
              ))}
            </div>
          </FamilyPanel>

          <div style={subjectColumn}>
            <div style={focusLabel}>Subject</div>
            <PersonNode person={model.subject} active onPick={onPick} onEditPerson={onEditPerson} large />
          </div>

          <FamilyPanel title="Spouses">
            {hasSpouses ? (
              <div style={spouseStack}>
                {model.spouses.map((person) => (
                  <div key={person.recordName} style={spouseRow}>
                    <PersonNode person={person} onPick={onPick} onEditPerson={onEditPerson} />
                    <div style={familyMeta}>
                      {person.dateOfMarriage ? <span>Married {person.dateOfMarriage}</span> : <span>No marriage date</span>}
                      {person.dateOfDivorce ? <span>Divorced {person.dateOfDivorce}</span> : null}
                      {person.familyRecordName ? (
                        <button type="button" style={linkButton} onClick={() => onOpenFamily(person.familyRecordName)}>
                          Edit family
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={panelEmpty}>No spouses recorded.</div>
            )}
          </FamilyPanel>
        </div>

        <Connector visible={hasChildren || hasSpouses} />

        <FamilyBand title="Children" emptyText="No children recorded." people={model.children} onPick={onPick} onEditPerson={onEditPerson} />
      </div>
    </div>
  );
}

function FamilyBand({ title, emptyText, people, onPick, onEditPerson }) {
  return (
    <FamilyPanel title={title}>
      {people.length ? (
        <div style={bandRow}>
          {people.map((person) => (
            <PersonNode key={person.recordName} person={person} onPick={onPick} onEditPerson={onEditPerson} />
          ))}
        </div>
      ) : (
        <div style={panelEmpty}>{emptyText}</div>
      )}
    </FamilyPanel>
  );
}

function FamilyPanel({ title, children }) {
  return (
    <section style={panel}>
      <div style={panelTitle}>{title}</div>
      {children}
    </section>
  );
}

function Connector({ visible }) {
  return <div style={{ ...connector, opacity: visible ? 1 : 0.18 }} aria-hidden="true" />;
}

function PersonNode({ person, active = false, large = false, onPick, onEditPerson }) {
  if (!person) return null;
  return (
    <button
      type="button"
      style={nodeStyle(person.gender, active, large)}
      onClick={() => onPick(person.recordName)}
      onDoubleClick={() => onEditPerson?.(person.recordName)}
      title={person.fullName}
    >
      <span style={avatar(person.gender)}>{initials(person.fullName)}</span>
      <span style={nodeText}>
        <span style={nodeName}>{person.fullName}</span>
        <span style={nodeLife}>{lifeSpanLabel(person) || 'No life dates'}</span>
        {person.relationToSubject ? <span style={nodeRelation}>{person.relationToSubject}</span> : null}
      </span>
    </button>
  );
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}

function palette(gender) {
  if (gender === Gender.Male) return ['hsl(206 74% 96%)', 'hsl(207 64% 48%)'];
  if (gender === Gender.Female) return ['hsl(344 72% 96%)', 'hsl(343 61% 52%)'];
  if (gender === Gender.Intersex) return ['hsl(275 66% 96%)', 'hsl(274 52% 50%)'];
  return ['hsl(var(--secondary))', 'hsl(var(--muted-foreground))'];
}

function nodeStyle(gender, active, large) {
  const [fill, stroke] = palette(gender);
  return {
    width: large ? 240 : 210,
    maxWidth: '100%',
    minHeight: large ? 86 : 74,
    border: active ? `2px solid ${stroke}` : `1px solid ${stroke}`,
    borderRadius: 8,
    background: fill,
    boxShadow: active ? '0 12px 28px rgb(0 0 0 / 0.14)' : '0 6px 16px rgb(0 0 0 / 0.07)',
    color: 'hsl(var(--foreground))',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: large ? 12 : 10,
    textAlign: 'start',
    cursor: 'pointer',
    flexShrink: 0,
  };
}

function avatar(gender) {
  const [, stroke] = palette(gender);
  return {
    width: 38,
    height: 38,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    background: stroke,
    color: '#fff',
    fontWeight: 800,
    fontSize: 12,
  };
}

const workspace = {
  height: '100%',
  overflow: 'auto',
  background: 'linear-gradient(180deg, hsl(var(--background)), hsl(var(--secondary)))',
};
const canvas = {
  minWidth: 980,
  minHeight: '100%',
  padding: 24,
  display: 'grid',
  alignContent: 'start',
};
const canvasMobile = {
  minHeight: '100%',
  padding: 12,
  display: 'grid',
  alignContent: 'start',
  gap: 4,
};
const panel = {
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  background: 'hsl(var(--card))',
  padding: 14,
  boxShadow: '0 8px 22px rgb(0 0 0 / 0.06)',
};
const panelTitle = {
  color: 'hsl(var(--muted-foreground))',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0,
  marginBottom: 10,
};
const panelEmpty = {
  color: 'hsl(var(--muted-foreground))',
  fontSize: 13,
  minHeight: 42,
  display: 'grid',
  placeItems: 'center',
};
const bandRow = {
  display: 'flex',
  justifyContent: 'center',
  gap: 12,
  flexWrap: 'wrap',
};
const siblingRow = {
  display: 'flex',
  gap: 10,
  overflowX: 'auto',
  paddingBottom: 2,
};
const middleGrid = {
  display: 'grid',
  gridTemplateColumns: 'minmax(270px, 1fr) 260px minmax(270px, 1fr)',
  gap: 16,
  alignItems: 'center',
};
const middleGridMobile = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 12,
  alignItems: 'stretch',
};
const subjectColumn = {
  display: 'grid',
  justifyItems: 'center',
  gap: 8,
};
const focusLabel = {
  color: 'hsl(var(--muted-foreground))',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
};
const spouseStack = {
  display: 'grid',
  gap: 10,
};
const spouseRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};
const familyMeta = {
  minWidth: 96,
  display: 'grid',
  gap: 4,
  color: 'hsl(var(--muted-foreground))',
  fontSize: 11,
};
const linkButton = {
  width: 'fit-content',
  border: 0,
  background: 'transparent',
  color: 'hsl(var(--primary))',
  padding: 0,
  font: '700 11px -apple-system, system-ui, sans-serif',
  cursor: 'pointer',
};
const connector = {
  width: 2,
  height: 32,
  justifySelf: 'center',
  background: 'hsl(var(--border))',
};
const nodeText = {
  minWidth: 0,
  display: 'grid',
  gap: 2,
};
const nodeName = {
  fontSize: 13,
  fontWeight: 800,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const nodeLife = {
  color: 'hsl(var(--muted-foreground))',
  fontSize: 11,
};
const nodeRelation = {
  color: 'hsl(var(--foreground))',
  fontSize: 11,
  fontWeight: 700,
};
const empty = {
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  color: 'hsl(var(--muted-foreground))',
  fontSize: 14,
};

export default FamilyTreeView;
