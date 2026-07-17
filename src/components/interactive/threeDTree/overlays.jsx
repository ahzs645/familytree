import React from 'react';
import { useTranslation } from '../../../contexts/LocalizationContext.jsx';
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
  const { t } = useTranslation();
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
        {t('interactiveTree.navParent')}
      </button>
      <button type="button" style={styles.dockButton} onClick={() => jump('partners')} disabled={!sections.some((section) => section.id === 'partners')}>
        {t('interactiveTree.navPartner')}
      </button>
      <button type="button" style={styles.dockButton} onClick={() => jump('children')} disabled={!sections.some((section) => section.id === 'children')}>
        {t('interactiveTree.navChild')}
      </button>
      <select
        value={selectValue}
        onChange={(event) => {
          if (event.target.value) onPick?.(event.target.value);
        }}
        style={styles.navigationSelect}
        aria-label={t('interactiveTree.navigateAria')}
      >
        <option value="">{t('interactiveTree.navigate')}</option>
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
  const { t } = useTranslation();
  return (
    <div style={{ ...styles.hoverCard, left: x + 14, top: y + 14 }}>
      <div style={styles.hoverName}>{person?.fullName || t('interactiveTree.unnamedPerson')}</div>
      <div style={styles.hoverMeta}>{lifeSpanLabel(person) || t('interactiveTree.noLifeDates')}</div>
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
  const { t } = useTranslation();
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
        <div style={styles.contextName}>{person?.fullName || t('interactiveTree.unnamedPerson')}</div>
        <div style={styles.contextMeta}>{lifeSpanLabel(person) || t('interactiveTree.noLifeDates')}</div>
      </div>
      <button type="button" style={styles.contextItem} onClick={() => run(onPick)} role="menuitem">{t('interactiveTree.focusOnPerson')}</button>
      <button type="button" style={styles.contextItem} onClick={() => run(onShowInfo)} role="menuitem">{t('interactiveTree.showInfo')}</button>
      <button type="button" style={styles.contextItem} onClick={() => run(onEditPerson)} role="menuitem">{t('interactiveTree.editPerson')}</button>
      {familyId && <button type="button" style={styles.contextItem} onClick={runFamily} role="menuitem">{t('interactiveTree.selectFamily')}</button>}
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
            {addOpen ? '▾' : '▸'} {t('interactiveTree.addRelatives')}
          </button>
          {addOpen && (
            <div style={styles.contextSubmenu}>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('father')}>{t('interactiveTree.addFather')}</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('mother')}>{t('interactiveTree.addMother')}</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('partner')}>{t('interactiveTree.addPartner')}</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('brother')}>{t('interactiveTree.addBrother')}</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('sister')}>{t('interactiveTree.addSister')}</button>
              {partners.length === 0 && (
                <>
                  <button type="button" style={styles.contextItem} onClick={() => runAdd('son')}>{t('interactiveTree.addSon')}</button>
                  <button type="button" style={styles.contextItem} onClick={() => runAdd('daughter')}>{t('interactiveTree.addDaughter')}</button>
                </>
              )}
              {partners.map((partner) => (
                <React.Fragment key={partner.recordName}>
                  <button type="button" style={styles.contextItem} onClick={() => runAdd('son', { partnerId: partner.recordName })}>
                    {t('interactiveTree.addSonWith', { name: partner.fullName || t('interactiveTree.partnerFallback') })}
                  </button>
                  <button type="button" style={styles.contextItem} onClick={() => runAdd('daughter', { partnerId: partner.recordName })}>
                    {t('interactiveTree.addDaughterWith', { name: partner.fullName || t('interactiveTree.partnerFallback') })}
                  </button>
                </React.Fragment>
              ))}
              <div style={styles.contextDivider} />
              <button type="button" style={styles.contextItem} onClick={() => runAdd('father')}>{t('interactiveTree.addFurtherFather')}</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('mother')}>{t('interactiveTree.addFurtherMother')}</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('partner')}>{t('interactiveTree.addFurtherPartner')}</button>
              <div style={styles.contextDivider} />
              <button type="button" style={styles.contextItem} onClick={() => runAdd('existingFather')}>{t('interactiveTree.selectExistingFather')}</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('existingMother')}>{t('interactiveTree.selectExistingMother')}</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('existingPartner')}>{t('interactiveTree.selectExistingPartner')}</button>
              <button type="button" style={styles.contextItem} onClick={() => runAdd('existingChild')}>{t('interactiveTree.selectExistingChild')}</button>
            </div>
          )}
        </>
      )}
      {(onEditInfluential || (onOpenFamilySearch && hasFamilySearch)) && (
        <>
          <div style={styles.contextDivider} />
          {onEditInfluential && (
            <button type="button" style={styles.contextItem} onClick={() => run(onEditInfluential)} role="menuitem">{t('interactiveTree.editInfluential')}</button>
          )}
          {onOpenFamilySearch && hasFamilySearch && (
            <>
              <button type="button" style={styles.contextItem} onClick={() => run(onOpenFamilySearch)} role="menuitem">{t('interactiveTree.displayFamilySearch')}</button>
              <button type="button" style={styles.contextItem} onClick={() => run(onOpenFamilySearch)} role="menuitem">{t('interactiveTree.matchesFamilySearch')}</button>
            </>
          )}
        </>
      )}
      <div style={styles.contextDivider} />
      <button type="button" style={styles.contextItem} onClick={() => run(onOpenAncestorChart)} role="menuitem">{t('interactiveTree.ancestorChart')}</button>
      <button type="button" style={styles.contextItem} onClick={() => run(onOpenDescendantChart)} role="menuitem">{t('interactiveTree.descendantChart')}</button>
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
              {t('interactiveTree.deletePerson')}
            </button>
          )}
          {onDeleteFamily && familyId && (
            <button
              type="button"
              style={{ ...styles.contextItem, color: '#c1322b' }}
              onClick={runDeleteFamily}
              role="menuitem"
            >
              {t('interactiveTree.deleteFamily')}
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
