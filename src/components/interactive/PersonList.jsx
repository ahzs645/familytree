/**
 * Left-pane sectioned person list for the Interactive Tree.
 * Groups persons alphabetically by last-name initial. Supports search filtering.
 */
import React, { useDeferredValue, useMemo, useState } from 'react';
import { BdiText, LtrText } from '../BdiText.jsx';
import { compareStrings, getCurrentLocalization, graphemes, normalizeSearchText, searchTextForms, searchTokenVariants } from '../../lib/i18n.js';
import { personSearchHaystack } from '../../lib/personLineage.js';
import { hasRealName, localizeNoName, shortPersonId } from '../../lib/personDisplayName.js';
import { useIsMobile } from '../../lib/useIsMobile.js';
import { lifeSpanLabel } from '../../models/index.js';
import { Gender } from '../../models/constants.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { Input } from '../ui/Input.jsx';
import { cn } from '../../lib/utils.js';

// Sentinel group key — not a letter, so it can never collide with an initial.
const UNNAMED_GROUP = '\u0000unnamed';

function initialFor(person, localization) {
  const firstGrapheme = graphemes(person.lastName || person.fullName || '#')[0] || '#';
  // Honorific stripping must stay off here: it exists to drop title tokens from
  // a full name, and a bare "ا" or "د" is one of those tokens, so it returned
  // "" for every alef- and dal-initial name. The fallback then used the raw
  // character, splitting أ / إ / آ / ا into four sections of the same letter.
  const normalized = normalizeSearchText(firstGrapheme, localization, { stripHonorifics: false });
  return (normalized || firstGrapheme).toLocaleUpperCase(localization.locale);
}

export function PersonList({ persons, activeId, onPick, selection = null, onToggleSelect = null, visibleColumns = null, renderBadge = null, searchRowActions = null }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const showColumn = (key) => !visibleColumns || visibleColumns.has(key);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const localization = getCurrentLocalization();
  const localizationKey = `${localization.locale}|${localization.direction}|${localization.numberingSystem}|${localization.calendar}`;
  const queryText = deferredQuery.trim();

  const indexedPersons = useMemo(() => persons.map((person, index) => {
    const normalizedFields = {
      fullName: normalizeSearchText(person?.fullName || '', localization),
      firstName: normalizeSearchText(person?.firstName || '', localization),
      lastName: normalizeSearchText(person?.lastName || '', localization),
      lineageSearchText: normalizeSearchText(person?.lineageSearchText || '', localization),
      haystack: normalizeSearchText(personSearchHaystack(person), localization),
      haystackForms: searchTextForms(personSearchHaystack(person), localization),
    };
    return { person, index, normalizedFields };
  }), [persons, localizationKey]);

  const normalizedQuery = useMemo(() => normalizeSearchText(queryText, localization), [queryText, localizationKey]);
  const queryWords = useMemo(
    () => normalizedQuery.split(/[^\p{L}\p{N}@_-]+/u).filter(Boolean),
    [normalizedQuery]
  );
  const queryVariantGroups = useMemo(
    () => queryWords.map((word) => searchTokenVariants(word, localization)),
    [queryWords, localizationKey]
  );

  const sections = useMemo(() => {
    const filtered = queryWords.length
      ? indexedPersons
        .filter(({ normalizedFields }) => indexedPersonMatches(normalizedFields, normalizedQuery, queryVariantGroups))
        .map(({ person, index, normalizedFields }) => ({
          person,
          index,
          score: scoreIndexedPersonSearch(normalizedFields, queryWords),
        }))
        .sort((a, b) => {
          const scoreDiff = b.score - a.score;
          if (scoreDiff) return scoreDiff;
          const genderDiff = (a.person.gender === Gender.Male ? 0 : 1) - (b.person.gender === Gender.Male ? 0 : 1);
          return genderDiff || compareStrings(a.person.fullName, b.person.fullName, localization) || a.index - b.index;
        })
        .map(({ person }) => person)
      : persons;
    const groups = new Map();
    for (const p of filtered) {
      // Persons with no recorded name display a placeholder ("No name
      // recorded"), and keying off that string filed them all under N, wedged
      // between real surnames. Give them their own bucket instead.
      const initial = hasRealName(p) ? initialFor(p, localization) : UNNAMED_GROUP;
      if (!groups.has(initial)) groups.set(initial, []);
      groups.get(initial).push(p);
    }
    return [...groups.entries()]
      .map(([letter, group]) => [letter, queryWords.length ? group : group.sort((a, b) => compareStrings(a.fullName, b.fullName, localization))])
      .sort(([a], [b]) => {
        // The unnamed bucket always sorts last, whatever the locale.
        if (a === UNNAMED_GROUP) return b === UNNAMED_GROUP ? 0 : 1;
        if (b === UNNAMED_GROUP) return -1;
        return compareStrings(a, b, localization);
      });
  }, [persons, indexedPersons, normalizedQuery, queryWords, queryVariantGroups, localizationKey]);

  return (
    <div className="flex h-full flex-col border-e border-border bg-card">
      {/* `searchRowActions` shares this row rather than taking one of its own —
          on a phone the page's actions used to sit on a separate line above. */}
      <div className="flex items-center gap-2 border-b border-border p-2.5">
        <Input
          dir="auto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('persons.searchPlaceholder')}
          className="h-10 min-w-0 flex-1"
        />
        {searchRowActions}
      </div>
      <div className="flex-1 overflow-auto">
        {sections.map(([letter, group]) => (
          <div key={letter}>
            <div className="sticky top-0 border-b border-border bg-muted px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
              {letter === UNNAMED_GROUP ? t('persons.unnamedGroup', { defaultValue: 'No name recorded' }) : letter}
            </div>
            {group.map((p) => {
              const isSelected = selection?.has(p.recordName);
              const isActive = p.recordName === activeId;
              return (
                <div
                  key={p.recordName}
                  // A row is the only way into a person on mobile, so it has to
                  // be a real control: focusable, Enter/Space activated, and
                  // announced as a button rather than as anonymous text.
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? 'true' : undefined}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onPick(p.recordName);
                  }}
                  onClick={(event) => {
                    if (onToggleSelect && (event.metaKey || event.ctrlKey || event.shiftKey)) {
                      onToggleSelect(p.recordName, { range: event.shiftKey });
                      return;
                    }
                    onPick(p.recordName);
                  }}
                  className={cn(
                    'cursor-pointer border-b border-border border-s-[3px] px-3 py-2',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    isActive
                      ? 'border-s-primary bg-secondary'
                      : isSelected
                        ? 'border-s-primary/50 bg-primary/[0.08]'
                        : 'border-s-transparent bg-transparent hover:bg-muted',
                    isMobile && 'min-h-11',
                    onToggleSelect ? 'flex items-center gap-2' : 'block'
                  )}
                >
                  {onToggleSelect ? (
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onToggleSelect(p.recordName, { range: event.nativeEvent?.shiftKey })}
                      aria-label={`${t('common.select')} ${p.fullName}`}
                      className="h-[18px] w-[18px] shrink-0"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    {showColumn('fullName') ? (
                      <div className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
                        <span className="min-w-0 overflow-hidden text-ellipsis"><BdiText>{localizeNoName(p.fullName)}</BdiText></span>
                        {renderBadge ? renderBadge(p) : null}
                      </div>
                    ) : null}
                    {showColumn('lifespan') && (p.birthDate || p.deathDate) ? (
                      <div className="text-xs text-muted-foreground">
                        <LtrText>{lifeSpanLabel(p)}</LtrText>
                      </div>
                    ) : null}
                    {/* Disambiguate otherwise-identical nameless rows: when there is
                        no real name, no dates, and no patrilineal tail to show,
                        surface the record id so 800+ rows aren't indistinguishable. */}
                    {!hasRealName(p) && !(p.birthDate || p.deathDate) && !p.arabicPatrilinealName ? (
                      <div className="text-xs text-muted-foreground">
                        {shortPersonId(p.recordName)}
                      </div>
                    ) : null}
                    {showColumn('arabicPatrilinealName') && p.arabicPatrilinealName && !p.nameIsPatrilineal ? (
                      <div className="text-xs text-muted-foreground [direction:rtl] text-start">
                        <BdiText>{p.arabicPatrilinealTail || p.arabicPatrilinealName}</BdiText>
                      </div>
                    ) : null}
                    {showColumn('outsideFamily') && p.outsideFamily ? (
                      <div className="text-2xs font-semibold text-interactive">{t('persons.outsideFamily')}</div>
                    ) : null}
                    {showColumn('bookmarked') && p.bookmarked ? (
                      <div className="text-2xs font-semibold text-interactive">★ {t('persons.bookmarked')}</div>
                    ) : null}
                    {showColumn('startPerson') && p.startPerson ? (
                      <div className="text-2xs font-semibold text-interactive">✓ {t('persons.startPerson')}</div>
                    ) : null}
                    {queryText && !p.nameIsPatrilineal && (p.arabicPatrilinealTail || p.arabicPatrilinealName) ? (
                      <div className="mt-0.5 text-2xs text-muted-foreground [direction:rtl] text-start">
                        <BdiText>{p.arabicPatrilinealTail || p.arabicPatrilinealName}</BdiText>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {sections.length === 0 && (
          <div className="p-5 text-sm text-muted-foreground">{t('common.noMatches')}</div>
        )}
      </div>
    </div>
  );
}

export default PersonList;

function scoreIndexedPersonSearch(fields, words) {
  let score = 0;
  const weightedFields = [
    { value: fields.fullName, weight: 450 },
    { value: fields.firstName, weight: 500 },
    { value: fields.lineageSearchText, weight: 220 },
    { value: fields.lastName, weight: 120 },
  ];

  for (const word of words) {
    let best = 0;
    for (const field of weightedFields) {
      if (!field.value) continue;
      if (field.value === word) best = Math.max(best, field.weight + 120);
      else if (field.value.startsWith(word)) best = Math.max(best, field.weight + 60);
      else if (field.value.includes(word)) best = Math.max(best, field.weight);
    }
    score += best;
  }

  const queryNorm = words.join(' ');
  if (fields.lineageSearchText.startsWith(queryNorm)) score += 800;
  else if (fields.lineageSearchText.includes(queryNorm)) score += 500;
  return score;
}

function indexedPersonMatches(fields, normalizedQuery, queryVariantGroups) {
  if (!normalizedQuery) return true;
  if (fields.haystackForms.some((form) => form.includes(normalizedQuery))) return true;
  return queryVariantGroups.every((variants) => (
    variants.some((variant) => fields.haystackForms.some((form) => form.includes(variant)))
  ));
}
