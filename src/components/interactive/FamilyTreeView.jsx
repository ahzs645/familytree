import React from 'react';
import { Gender, lifeSpanLabel } from '../../models/index.js';
import { useIsMobile } from '../../lib/useIsMobile.js';
import { BdiText, LtrText } from '../BdiText.jsx';
import { cn } from '../../lib/utils.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

const emptyClass = 'h-full grid place-items-center text-sm text-muted-foreground';

export function FamilyTreeView({ model, activeId, loading, onPick, onEditPerson, onOpenFamily, menu }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  if (loading) return <div className={emptyClass}>{t('familyTreeView.loading', { defaultValue: 'Loading family tree…' })}</div>;
  if (!model) return <div className={emptyClass}>{t('familyTreeView.pickPerson', { defaultValue: 'Pick a person to view their family tree.' })}</div>;

  const hasParents = model.parents.length > 0;
  const hasSpouses = model.spouses.length > 0;
  const hasChildren = model.children.length > 0;

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-background to-secondary">
      <div className={cn('grid min-h-full content-start', isMobile ? 'gap-1 p-3' : 'min-w-[980px] p-6')}>
        <FamilyBand title={t('interactiveTree.navSection.parents', { defaultValue: 'Parents' })} emptyText={t('editor.person.noParents', { defaultValue: 'No parents recorded' })} people={model.parents} onPick={onPick} onEditPerson={onEditPerson} menu={menu} />

        <Connector visible={hasParents || model.siblings.length > 1} />

        <div
          className={cn(
            'grid',
            isMobile
              ? 'grid-cols-1 items-stretch gap-3'
              : 'grid-cols-[minmax(270px,1fr)_260px_minmax(270px,1fr)] items-center gap-4'
          )}
        >
          <FamilyPanel title={t('familyTreeView.siblings', { defaultValue: 'Siblings' })}>
            <div className="flex gap-2.5 overflow-x-auto pb-0.5">
              {model.siblings.map((person) => (
                <PersonNode
                  key={person.recordName}
                  person={person}
                  active={person.recordName === activeId}
                  onPick={onPick}
                  onEditPerson={onEditPerson}
                  menu={menu}
                />
              ))}
            </div>
          </FamilyPanel>

          <div className="grid justify-items-center gap-2">
            <div className="text-xs font-extrabold uppercase text-muted-foreground">{t('familyTreeView.subject', { defaultValue: 'Subject' })}</div>
            <PersonNode person={model.subject} active onPick={onPick} onEditPerson={onEditPerson} menu={menu} large />
          </div>

          <FamilyPanel title={t('familyTreeView.spouses', { defaultValue: 'Spouses' })}>
            {hasSpouses ? (
              <div className="grid gap-2.5">
                {model.spouses.map((person) => (
                  <div key={person.recordName} className="flex items-center gap-2.5">
                    <PersonNode person={person} onPick={onPick} onEditPerson={onEditPerson} menu={menu} />
                    <div className="grid min-w-24 gap-1 text-xs text-muted-foreground">
                      {person.dateOfMarriage ? <span>{t('familyTreeView.married', { date: person.dateOfMarriage, defaultValue: `Married ${person.dateOfMarriage}` })}</span> : <span>{t('familyTreeView.noMarriageDate', { defaultValue: 'No marriage date' })}</span>}
                      {person.dateOfDivorce ? <span>{t('familyTreeView.divorced', { date: person.dateOfDivorce, defaultValue: `Divorced ${person.dateOfDivorce}` })}</span> : null}
                      {person.familyRecordName ? (
                        <button
                          type="button"
                          className="w-fit cursor-pointer border-0 bg-transparent p-0 text-xs font-bold text-interactive"
                          onClick={() => onOpenFamily(person.familyRecordName)}
                        >
                          {t('familyTreeView.editFamily', { defaultValue: 'Edit family' })}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty>{t('familyTreeView.noSpouses', { defaultValue: 'No spouses recorded.' })}</PanelEmpty>
            )}
          </FamilyPanel>
        </div>

        <Connector visible={hasChildren || hasSpouses} />

        <FamilyBand title={t('interactiveTree.navSection.children', { defaultValue: 'Children' })} emptyText={t('familyTreeView.noChildren', { defaultValue: 'No children recorded.' })} people={model.children} onPick={onPick} onEditPerson={onEditPerson} menu={menu} />
      </div>
    </div>
  );
}

function FamilyBand({ title, emptyText, people, onPick, onEditPerson, menu }) {
  return (
    <FamilyPanel title={title}>
      {people.length ? (
        <div className="flex flex-wrap justify-center gap-3">
          {people.map((person) => (
            <PersonNode key={person.recordName} person={person} onPick={onPick} onEditPerson={onEditPerson} menu={menu} />
          ))}
        </div>
      ) : (
        <PanelEmpty>{emptyText}</PanelEmpty>
      )}
    </FamilyPanel>
  );
}

function FamilyPanel({ title, children }) {
  return (
    <section className="rounded-md border border-border bg-card p-3.5 shadow-[0_8px_22px_rgb(0_0_0/0.06)]">
      <div className="mb-2.5 text-xs font-extrabold uppercase text-muted-foreground">{title}</div>
      {children}
    </section>
  );
}

function PanelEmpty({ children }) {
  return <div className="grid min-h-[42px] place-items-center text-sm text-muted-foreground">{children}</div>;
}

function Connector({ visible }) {
  return <div className={cn('h-8 w-0.5 justify-self-center bg-border', !visible && 'opacity-[0.18]')} aria-hidden="true" />;
}

function PersonNode({ person, active = false, large = false, onPick, onEditPerson, menu }) {
  const { t } = useTranslation();
  if (!person) return null;
  const [fill, stroke] = palette(person.gender);
  return (
    <button
      type="button"
      className={cn(
        'flex max-w-full shrink-0 cursor-pointer items-center gap-2.5 rounded-md text-start text-foreground',
        active ? 'shadow-[0_12px_28px_rgb(0_0_0/0.14)]' : 'shadow-[0_6px_16px_rgb(0_0_0/0.07)]',
        large ? 'min-h-[86px] w-60 p-3' : 'min-h-[74px] w-[210px] p-2.5'
      )}
      style={{ background: fill, border: `${active ? 2 : 1}px solid ${stroke}` }}
      onClick={() => onPick(person.recordName)}
      onDoubleClick={() => onEditPerson?.(person.recordName)}
      title={person.fullName}
      {...(menu?.handlersFor?.({ person, node: { familyBlockId: person.familyRecordName } }) || {})}
    >
      {/* Avatar fills are fixed mid-tone gender colors, so the white initials
          stay readable in both themes. */}
      <span
        className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full text-xs font-extrabold text-white"
        style={{ background: stroke }}
      >
        {initials(person.fullName)}
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-sm font-extrabold"><BdiText>{person.fullName}</BdiText></span>
        <span className="text-xs text-muted-foreground"><LtrText>{lifeSpanLabel(person) || t('interactiveTree.noLifeDates')}</LtrText></span>
        {person.relationToSubject ? <span className="text-xs font-bold text-foreground">{t(`relations.${person.relationToSubject}`, { defaultValue: person.relationToSubject })}</span> : null}
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

export default FamilyTreeView;
