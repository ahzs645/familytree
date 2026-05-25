/**
 * Left-pane sectioned person list for the Interactive Tree.
 * Groups persons alphabetically by last-name initial. Supports search filtering.
 */
import React, { useMemo, useState } from 'react';
import { BdiText } from '../BdiText.jsx';
import { compareStrings, getCurrentLocalization, graphemes, normalizeSearchText } from '../../lib/i18n.js';
import { comparePersonSearchResults, matchesPersonLineageSearch } from '../../lib/personLineage.js';
import { lifeSpanLabel } from '../../models/index.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

export function PersonList({ persons, activeId, onPick, selection = null, onToggleSelect = null, visibleColumns = null, renderBadge = null }) {
  const { t } = useTranslation();
  const showColumn = (key) => !visibleColumns || visibleColumns.has(key);
  const [query, setQuery] = useState('');
  const localization = getCurrentLocalization();
  const localizationKey = `${localization.locale}|${localization.direction}|${localization.numberingSystem}|${localization.calendar}`;

  const sections = useMemo(() => {
    const filtered = query.trim()
      ? persons
        .filter((p) => matchesPersonLineageSearch(p, query, localization))
        .sort((a, b) => comparePersonSearchResults(a, b, query, localization))
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
      .map(([letter, group]) => [letter, query.trim() ? group : group.sort((a, b) => compareStrings(a.fullName, b.fullName, localization))])
      .sort(([a], [b]) => compareStrings(a, b, localization));
  }, [persons, query, localizationKey]);

  return (
    <div style={shell}>
      <div style={searchBar}>
        <input
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
                        {lifeSpanLabel(p)}
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
                    {query.trim() && !p.nameIsPatrilineal && (p.arabicPatrilinealTail || p.arabicPatrilinealName) ? (
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
  outline: 'none',
  boxSizing: 'border-box',
  direction: 'auto',
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
