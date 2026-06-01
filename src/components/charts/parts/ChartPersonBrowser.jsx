/**
 * Right-side panel that lists every person in the tree with a search box
 * and grouping selector. Clicking a row re-roots the chart to that person.
 *
 * The visible list is capped at 700 rows; for trees larger than that, the
 * search box is the practical way to find the right person.
 */
import React from 'react';
import { chartPersonBrowserStyle, optionSelect } from './styles.js';
import { BdiText, LtrText } from '../../BdiText.jsx';

export function ChartPersonBrowser({ persons, rootId, query, onQueryChange, group, onGroupChange, onPick, onAllPersons, onSmartFilters }) {
  return (
    <aside style={chartPersonBrowserStyle}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button type="button" onClick={onAllPersons} style={optionSelect}>All Persons</button>
        <button type="button" onClick={onSmartFilters} style={optionSelect}>Smart Filters</button>
      </div>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Find</div>
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Find person" style={optionSelect} />
      </label>
      <label style={{ display: 'block', marginBottom: 10 }}>
        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Group by</div>
        <select value={group} onChange={(event) => onGroupChange(event.target.value)} style={optionSelect}>
          <option value="lastName">Last Name</option>
          <option value="firstName">First Name</option>
          <option value="birth">Birth Year</option>
        </select>
      </label>
      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 6 }}>{persons.length.toLocaleString()} persons</div>
      <div style={{ overflow: 'auto', minHeight: 0 }}>
        {persons.slice(0, 700).map((person) => {
          const active = person.recordName === rootId;
          return (
            <button
              type="button"
              key={person.recordName}
              onClick={() => onPick(person.recordName)}
              style={{
                width: '100%',
                textAlign: 'start',
                padding: '7px 8px',
                border: '1px solid hsl(var(--border))',
                borderRadius: 6,
                marginBottom: 5,
                background: active ? 'hsl(var(--accent))' : 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><BdiText>{person.fullName || person.recordName}</BdiText></div>
              <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}><LtrText>{person.birthDate || 'Birth unknown'}</LtrText></div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
