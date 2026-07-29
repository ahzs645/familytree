import React from 'react';
import { useTranslation } from '../../../contexts/LocalizationContext.jsx';
import { lifeSpanLabel } from '../../../models/index.js';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../ui/Button.jsx';
import { buildTreeNavigationOptions, firstNavigationOption } from './navigationOptions.js';

const DOCK_SELECT_CLASS =
  'h-8 cursor-pointer rounded-md border border-border bg-secondary ps-2 pe-6 text-xs font-bold text-secondary-foreground';

export function Metric({ label, value }) {
  return (
    <div className="min-w-[58px] border-s border-border px-1.5 py-0.5 text-center">
      <span className="block text-sm font-extrabold text-foreground">{value}</span>
      <span className="block text-[10px] font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

export function ViewerSelect({ label, value, options, onChange }) {
  return (
    <label className="flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-muted-foreground">
      <span className="inline-block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(DOCK_SELECT_CLASS, 'min-w-[84px]')}
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
    <div className="flex min-w-0 shrink flex-wrap items-center gap-1.5 ps-0.5">
      <Button onClick={() => jump('parents')} disabled={!sections.some((section) => section.id === 'parents')}>
        {t('interactiveTree.navParent')}
      </Button>
      <Button onClick={() => jump('partners')} disabled={!sections.some((section) => section.id === 'partners')}>
        {t('interactiveTree.navPartner')}
      </Button>
      <Button onClick={() => jump('children')} disabled={!sections.some((section) => section.id === 'children')}>
        {t('interactiveTree.navChild')}
      </Button>
      <select
        value={selectValue}
        onChange={(event) => {
          if (event.target.value) onPick?.(event.target.value);
        }}
        className={cn(DOCK_SELECT_CLASS, 'min-w-0 flex-[1_1_150px] max-w-[min(230px,100%)]')}
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
    <div
      className="pointer-events-none fixed z-40 max-w-[220px] rounded-md border border-border bg-card/90 px-2.5 py-2 shadow-lg backdrop-blur-md"
      style={{ left: x + 14, top: y + 14 }}
    >
      <div className="truncate text-xs font-bold text-card-foreground">{person?.fullName || t('interactiveTree.unnamedPerson')}</div>
      <div className="mt-0.5 text-xs font-medium text-muted-foreground">{lifeSpanLabel(person) || t('interactiveTree.noLifeDates')}</div>
    </div>
  );
}

function MenuItem({ className, ...props }) {
  return (
    <Button
      variant="ghost"
      {...props}
      className={cn('min-h-[30px] w-full justify-start text-start font-bold', className)}
    />
  );
}

function MenuDivider() {
  return <div className="mx-0.5 my-1 h-px bg-border/80" />;
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
      className="fixed z-50 w-[230px] rounded-md border border-border bg-card/95 p-1.5 text-card-foreground shadow-xl backdrop-blur-md"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
    >
      <div className="mb-1 border-b border-border px-2 pb-2 pt-1.5">
        <div className="truncate text-xs font-bold">{person?.fullName || t('interactiveTree.unnamedPerson')}</div>
        <div className="mt-0.5 text-xs font-medium text-muted-foreground">{lifeSpanLabel(person) || t('interactiveTree.noLifeDates')}</div>
      </div>
      <MenuItem onClick={() => run(onPick)} role="menuitem">{t('interactiveTree.focusOnPerson')}</MenuItem>
      <MenuItem onClick={() => run(onShowInfo)} role="menuitem">{t('interactiveTree.showInfo')}</MenuItem>
      <MenuItem onClick={() => run(onEditPerson)} role="menuitem">{t('interactiveTree.editPerson')}</MenuItem>
      {familyId && <MenuItem onClick={runFamily} role="menuitem">{t('interactiveTree.selectFamily')}</MenuItem>}
      {onAddRelative && (
        <>
          <MenuDivider />
          <MenuItem
            onClick={() => setAddOpen((open) => !open)}
            role="menuitem"
            aria-expanded={addOpen}
          >
            {addOpen ? '▾' : '▸'} {t('interactiveTree.addRelatives')}
          </MenuItem>
          {addOpen && (
            <div className="my-0.5 ms-1 flex max-h-80 flex-col overflow-y-auto border-s-2 border-border ps-3">
              <MenuItem onClick={() => runAdd('father')}>{t('interactiveTree.addFather')}</MenuItem>
              <MenuItem onClick={() => runAdd('mother')}>{t('interactiveTree.addMother')}</MenuItem>
              <MenuItem onClick={() => runAdd('partner')}>{t('interactiveTree.addPartner')}</MenuItem>
              <MenuItem onClick={() => runAdd('brother')}>{t('interactiveTree.addBrother')}</MenuItem>
              <MenuItem onClick={() => runAdd('sister')}>{t('interactiveTree.addSister')}</MenuItem>
              {partners.length === 0 && (
                <>
                  <MenuItem onClick={() => runAdd('son')}>{t('interactiveTree.addSon')}</MenuItem>
                  <MenuItem onClick={() => runAdd('daughter')}>{t('interactiveTree.addDaughter')}</MenuItem>
                </>
              )}
              {partners.map((partner) => (
                <React.Fragment key={partner.recordName}>
                  <MenuItem onClick={() => runAdd('son', { partnerId: partner.recordName })}>
                    {t('interactiveTree.addSonWith', { name: partner.fullName || t('interactiveTree.partnerFallback') })}
                  </MenuItem>
                  <MenuItem onClick={() => runAdd('daughter', { partnerId: partner.recordName })}>
                    {t('interactiveTree.addDaughterWith', { name: partner.fullName || t('interactiveTree.partnerFallback') })}
                  </MenuItem>
                </React.Fragment>
              ))}
              <MenuDivider />
              <MenuItem onClick={() => runAdd('father')}>{t('interactiveTree.addFurtherFather')}</MenuItem>
              <MenuItem onClick={() => runAdd('mother')}>{t('interactiveTree.addFurtherMother')}</MenuItem>
              <MenuItem onClick={() => runAdd('partner')}>{t('interactiveTree.addFurtherPartner')}</MenuItem>
              <MenuDivider />
              <MenuItem onClick={() => runAdd('existingFather')}>{t('interactiveTree.selectExistingFather')}</MenuItem>
              <MenuItem onClick={() => runAdd('existingMother')}>{t('interactiveTree.selectExistingMother')}</MenuItem>
              <MenuItem onClick={() => runAdd('existingPartner')}>{t('interactiveTree.selectExistingPartner')}</MenuItem>
              <MenuItem onClick={() => runAdd('existingChild')}>{t('interactiveTree.selectExistingChild')}</MenuItem>
            </div>
          )}
        </>
      )}
      {(onEditInfluential || (onOpenFamilySearch && hasFamilySearch)) && (
        <>
          <MenuDivider />
          {onEditInfluential && (
            <MenuItem onClick={() => run(onEditInfluential)} role="menuitem">{t('interactiveTree.editInfluential')}</MenuItem>
          )}
          {onOpenFamilySearch && hasFamilySearch && (
            <>
              <MenuItem onClick={() => run(onOpenFamilySearch)} role="menuitem">{t('interactiveTree.displayFamilySearch')}</MenuItem>
              <MenuItem onClick={() => run(onOpenFamilySearch)} role="menuitem">{t('interactiveTree.matchesFamilySearch')}</MenuItem>
            </>
          )}
        </>
      )}
      <MenuDivider />
      <MenuItem onClick={() => run(onOpenAncestorChart)} role="menuitem">{t('interactiveTree.ancestorChart')}</MenuItem>
      <MenuItem onClick={() => run(onOpenDescendantChart)} role="menuitem">{t('interactiveTree.descendantChart')}</MenuItem>
      {(onDeletePerson || (onDeleteFamily && familyId)) && (
        <>
          <MenuDivider />
          {onDeletePerson && (
            <MenuItem
              className="text-destructive-text hover:bg-destructive/10"
              onClick={() => run(onDeletePerson)}
              role="menuitem"
            >
              {t('interactiveTree.deletePerson')}
            </MenuItem>
          )}
          {onDeleteFamily && familyId && (
            <MenuItem
              className="text-destructive-text hover:bg-destructive/10"
              onClick={runDeleteFamily}
              role="menuitem"
            >
              {t('interactiveTree.deleteFamily')}
            </MenuItem>
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

