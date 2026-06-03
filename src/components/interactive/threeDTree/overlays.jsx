import React from 'react';
import { lifeSpanLabel } from '../../../models/index.js';
import { styles, dockToggleStyle } from './styles.js';
import { buildTreeNavigationOptions, firstNavigationOption } from './navigationOptions.js';

export function Metric({ label, value }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricValue}>{value}</span>
      <span style={styles.metricLabel}>{label}</span>
    </div>
  );
}

export function ViewerSelect({ label, value, options, onChange }) {
  return (
    <label style={styles.selectLabel}>
      <span style={styles.selectText}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={styles.select}
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function TreeNavigationControls({ context, onPick }) {
  const sections = buildTreeNavigationOptions(context);
  const selectValue = '';
  const jump = (sectionId) => {
    const option = firstNavigationOption(context, sectionId);
    if (option) onPick?.(option.id);
  };
  if (!sections.length) return null;
  return (
    <div style={styles.navDockGroup}>
      <button type="button" style={styles.dockButton} onClick={() => jump('parents')} disabled={!sections.some((section) => section.id === 'parents')}>
        Parent
      </button>
      <button type="button" style={styles.dockButton} onClick={() => jump('partners')} disabled={!sections.some((section) => section.id === 'partners')}>
        Partner
      </button>
      <button type="button" style={styles.dockButton} onClick={() => jump('children')} disabled={!sections.some((section) => section.id === 'children')}>
        Child
      </button>
      <select
        value={selectValue}
        onChange={(event) => {
          if (event.target.value) onPick?.(event.target.value);
        }}
        style={styles.navigationSelect}
        aria-label="Navigate family tree"
      >
        <option value="">Navigate...</option>
        {sections.map((section) => (
          <optgroup key={section.id} label={section.label}>
            {section.options.map((option) => (
              <option key={`${section.id}:${option.id}`} value={option.id}>
                {option.relation}: {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export function PersonHoverCard({ person, x, y }) {
  return (
    <div style={{ ...styles.hoverCard, left: x + 14, top: y + 14 }}>
      <div style={styles.hoverName}>{person?.fullName || 'Unnamed person'}</div>
      <div style={styles.hoverMeta}>{lifeSpanLabel(person) || 'No life dates'}</div>
    </div>
  );
}

export function PersonContextMenu({
  node,
  person,
  x,
  y,
  onClose,
  onPick,
  onEditPerson,
  onOpenFamily,
  onShowInfo,
  onOpenAncestorChart,
  onOpenDescendantChart,
  onAddRelative,
  onDeletePerson,
  onDeleteFamily,
  onEditInfluential,
  onOpenFamilySearch,
  context,
}) {
  const familyId = selectableFamilyId(node);
  const hasFamilySearch = Boolean(node?.status?.familySearch);
  const run = (handler) => {
    onClose?.();
    handler?.(person?.recordName);
  };
  const runFamily = () => {
    onClose?.();
    if (familyId) onOpenFamily?.(familyId);
  };
  const runDeleteFamily = () => {
    onClose?.();
    if (familyId) onDeleteFamily?.(familyId);
  };
  const runAdd = (relation, options = {}) => {
    onClose?.();
    onAddRelative?.({ relation, anchorId: person?.recordName, ...options });
  };
  const [addOpen, setAddOpen] = useStateLike(false);
  const partners = (context?.families || []).map((family) => family.partner).filter(Boolean);
  return (
    <div
      style={{ ...styles.contextMenu, left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
    >
      <div style={styles.contextHeader}>
        <div style={styles.contextName}>{person?.fullName || 'Unnamed person'}</div>
        <div style={styles.contextMeta}>{lifeSpanLabel(person) || 'No life dates'}</div>
      </div>
      <button type="button" style={styles.contextItem} onClick={() => run(onPick)} role="menuitem">Focus on Person</button>
      <button type="button" style={styles.contextItem} onClick={() => run(onShowInfo)} role="menuitem">Show Info</button>
      <button type="button" style={styles.contextItem} onClick={() => run(onEditPerson)} role="menuitem">Edit Person</button>
      {familyId && <button type="button" style={styles.contextItem} onClick={runFamily} role="menuitem">Select Family…</button>}
      {onAddRelative && (
        <>
          <div style={styles.contextDivider} />
          <button
            type="button"
            style={styles.contextItem}
            onClick={() => setAddOpen((open) => !open)}
            role="menuitem"
            aria-expanded={addOpen}
          >
            {addOpen ? '▾' : '▸'} Add Relatives…
          </button>
          {addOpen && (
            <div style={styles.contextSubmenu}>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('father')}>Add Father</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('mother')}>Add Mother</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('partner')}>Add Partner</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('brother')}>Add Brother</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('sister')}>Add Sister</button>
              {partners.length === 0 && (
                <>
                  <button type="button" style={styles.contextItem} onClick={() => runAdd('son')}>Add Son</button>
                  <button type="button" style={styles.contextItem} onClick={() => runAdd('daughter')}>Add Daughter</button>
                </>
              )}
              {partners.map((partner) => (
                <React.Fragment key={partner.recordName}>
                  <button type="button" style={styles.contextItem} onClick={() => runAdd('son', { partnerId: partner.recordName })}>
                    Add Son with {partner.fullName || 'partner'}
                  </button>
                  <button type="button" style={styles.contextItem} onClick={() => runAdd('daughter', { partnerId: partner.recordName })}>
                    Add Daughter with {partner.fullName || 'partner'}
                  </button>
                </React.Fragment>
              ))}
              <div style={styles.contextDivider} />
              <button type="button" style={styles.contextItem} onClick={() => runAdd('father')}>Add Further Father</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('mother')}>Add Further Mother</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('partner')}>Add Further Partner</button>
              <div style={styles.contextDivider} />
              <button type="button" style={styles.contextItem} onClick={() => runAdd('existingFather')}>Select Existing Person as Father</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('existingMother')}>Select Existing Person as Mother</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('existingPartner')}>Select Existing Person as Partner</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('existingChild')}>Select Existing Person as Child</button>
            </div>
          )}
        </>
      )}
      {(onEditInfluential || (onOpenFamilySearch && hasFamilySearch)) && (
        <>
          <div style={styles.contextDivider} />
          {onEditInfluential && (
            <button type="button" style={styles.contextItem} onClick={() => run(onEditInfluential)} role="menuitem">Add / Edit Influential Persons…</button>
          )}
          {onOpenFamilySearch && hasFamilySearch && (
            <>
              <button type="button" style={styles.contextItem} onClick={() => run(onOpenFamilySearch)} role="menuitem">Display FamilySearch Person</button>
              <button type="button" style={styles.contextItem} onClick={() => run(onOpenFamilySearch)} role="menuitem">Matches on FamilySearch</button>
            </>
          )}
        </>
      )}
      <div style={styles.contextDivider} />
      <button type="button" style={styles.contextItem} onClick={() => run(onOpenAncestorChart)} role="menuitem">Ancestor Chart</button>
      <button type="button" style={styles.contextItem} onClick={() => run(onOpenDescendantChart)} role="menuitem">Descendant Chart</button>
      {(onDeletePerson || (onDeleteFamily && familyId)) && (
        <>
          <div style={styles.contextDivider} />
          {onDeletePerson && (
            <button
              type="button"
              style={{ ...styles.contextItem, color: '#c1322b' }}
              onClick={() => run(onDeletePerson)}
              role="menuitem"
            >
              Delete Person…
            </button>
          )}
          {onDeleteFamily && familyId && (
            <button
              type="button"
              style={{ ...styles.contextItem, color: '#c1322b' }}
              onClick={runDeleteFamily}
              role="menuitem"
            >
              Delete Family…
            </button>
          )}
        </>
      )}
    </div>
  );
}

function useStateLike(initial) {
  return React.useState(initial);
}

function selectableFamilyId(node) {
  const id = node?.familyBlockId;
  if (!id || id === 'root' || id.startsWith?.('leaf:')) return null;
  return id;
}

export { dockToggleStyle };
