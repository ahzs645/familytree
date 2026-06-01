/**
 * Left-pane sectioned person list for the Interactive Tree.
 * Groups persons alphabetically by last-name initial. Supports search filtering.
 */
import React, { useDeferredValue, useMemo, useState } from 'react';
import { BdiText, LtrText } from '../BdiText.jsx';
import { compareStrings, getCurrentLocalization, graphemes, normalizeSearchText, searchTextForms, searchTokenVariants } from '../../lib/i18n.js';
import { personSearchHaystack } from '../../lib/personLineage.js';
import { hasRealName, shortPersonId } from '../../lib/personDisplayName.js';
import { useIsMobile } from '../../lib/useIsMobile.js';
import { lifeSpanLabel } from '../../models/index.js';
import { Gender } from '../../models/constants.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

export function PersonList({ persons, activeId, onPick, selection = null, onToggleSelect = null, visibleColumns = null, renderBadge = null }) {
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
      const firstGrapheme = graphemes(p.lastName || p.fullName || '#')[0] || '#';
      const normalized = normalizeSearchText(firstGrapheme, localization);
      const initial = (normalized || firstGrapheme).toLocaleUpperCase(localization.locale);
      if (!groups.has(initial)) groups.set(initial, []);
      groups.get(initial).push(p);
    }
    return [...groups.entries()]
      .map(([letter, group]) => [letter, queryWords.length ? group : group.sort((a, b) => compareStrings(a.fullName, b.fullName, localization))])
      .sort(([a], [b]) => compareStrings(a, b, localization));
  }, [persons, indexedPersons, normalizedQuery, queryWords, queryVariantGroups, localizationKey]);

  return (
    <div style={shell}>
      <div style={searchBar}>
        <input
          dir="auto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('persons.searchPlaceholder')}
          style={search}
        />
      </div>
      <div style={list}>
        {sections.map(([letter, group]) => (
          <div key={letter}>
            <div style={sectionHeader}>{letter}</div>
            {group.map((p) => {
              const isSelected = selection?.has(p.recordName);
              return (
                <div
                  key={p.recordName}
                  onClick={(event) => {
                    if (onToggleSelect && (event.metaKey || event.ctrlKey || event.shiftKey)) {
                      onToggleSelect(p.recordName, { range: event.shiftKey });
                      return;
                    }
                    onPick(p.recordName);
                  }}
                  style={{
                    ...row,
                    ...(isMobile ? { minHeight: 44 } : null),
                    background: p.recordName === activeId ? 'hsl(var(--secondary))' : isSelected ? 'hsl(var(--primary) / 0.08)' : 'transparent',
                    borderInlineStart: p.recordName === activeId ? '3px solid hsl(var(--primary))' : isSelected ? '3px solid hsl(var(--primary) / 0.5)' : '3px solid transparent',
                    display: onToggleSelect ? 'flex' : 'block',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={(e) => {
                    if (p.recordName !== activeId && !isSelected) e.currentTarget.style.background = 'hsl(var(--muted))';
                  }}
                  onMouseLeave={(e) => {
                    if (p.recordName !== activeId && !isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {onToggleSelect ? (
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onToggleSelect(p.recordName, { range: event.nativeEvent?.shiftKey })}
                      aria-label={`${t('common.select')} ${p.fullName}`}
                      style={{ width: 18, height: 18, flexShrink: 0 }}
                    />
                  ) : null}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {showColumn('fullName') ? (
                      <div style={{ color: 'hsl(var(--foreground))', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}><BdiText>{p.fullName}</BdiText></span>
                        {renderBadge ? renderBadge(p) : null}
                      </div>
                    ) : null}
                    {showColumn('lifespan') && (p.birthDate || p.deathDate) ? (
                      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>
                        <LtrText>{lifeSpanLabel(p)}</LtrText>
                      </div>
                    ) : null}
                    {/* Disambiguate otherwise-identical nameless rows: when there is
                        no real name, no dates, and no patrilineal tail to show,
                        surface the record id so 800+ rows aren't indistinguishable. */}
                    {!hasRealName(p) && !(p.birthDate || p.deathDate) && !p.arabicPatrilinealName ? (
                      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>
                        {shortPersonId(p.recordName)}
                      </div>
                    ) : null}
                    {showColumn('arabicPatrilinealName') && p.arabicPatrilinealName && !p.nameIsPatrilineal ? (
                      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, direction: 'rtl', textAlign: 'start' }}>
                        <BdiText>{p.arabicPatrilinealTail || p.arabicPatrilinealName}</BdiText>
                      </div>
                    ) : null}
                    {showColumn('outsideFamily') && p.outsideFamily ? (
                      <div style={{ color: 'hsl(var(--primary))', fontSize: 10, fontWeight: 600 }}>Outside main family</div>
                    ) : null}
                    {showColumn('bookmarked') && p.bookmarked ? (
                      <div style={{ color: 'hsl(var(--primary))', fontSize: 10, fontWeight: 600 }}>★ {t('persons.bookmarked')}</div>
                    ) : null}
                    {showColumn('startPerson') && p.startPerson ? (
                      <div style={{ color: 'hsl(var(--primary))', fontSize: 10, fontWeight: 600 }}>✓ {t('persons.startPerson')}</div>
                    ) : null}
                    {queryText && !p.nameIsPatrilineal && (p.arabicPatrilinealTail || p.arabicPatrilinealName) ? (
                      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10, marginTop: 2, direction: 'rtl', textAlign: 'start' }}>
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
          <div style={{ padding: 20, color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>{t('common.noMatches')}</div>
        )}
      </div>
    </div>
  );
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%', borderInlineEnd: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' };
const searchBar = { padding: 10, borderBottom: '1px solid hsl(var(--border))' };
const search = {
  width: '100%',
  height: 40,
  background: 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '0 12px',
  font: '14px -apple-system, system-ui, sans-serif',
  boxSizing: 'border-box',
};
const list = { flex: 1, overflow: 'auto' };
const sectionHeader = {
  background: 'hsl(var(--muted))',
  color: 'hsl(var(--muted-foreground))',
  fontSize: 11,
  fontWeight: 600,
  padding: '6px 12px',
  letterSpacing: 0.5,
  borderBottom: '1px solid hsl(var(--border))',
  position: 'sticky',
  top: 0,
};
const row = { padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border))' };

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
