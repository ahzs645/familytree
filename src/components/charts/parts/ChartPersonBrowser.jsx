/**
 * Right-side panel that lists every person in the tree with a search box
 * and grouping selector. Clicking a row re-roots the chart to that person.
 *
 * The visible list is capped at 700 rows; for trees larger than that, the
 * search box is the practical way to find the right person.
 */
import React from 'react';
import { BdiText, LtrText } from '../../BdiText.jsx';
import { Select } from '../../ui/Select.jsx';
import { Button } from '../../ui/Button.jsx';
import { Input } from '../../ui/Input.jsx';
import { cn } from '../../../lib/utils.js';
import { useTranslation } from '../../../contexts/LocalizationContext.jsx';

export function ChartPersonBrowser({ persons, rootId, query, onQueryChange, group, onGroupChange, onPick, onAllPersons, onSmartFilters }) {
  const { t } = useTranslation();
  return (
    <aside className="flex w-[260px] shrink-0 flex-col min-h-0 border-s border-border bg-card p-3 text-card-foreground">
      <div className="mb-2 flex gap-1.5">
        <Button onClick={onAllPersons}>{t('charts.allPersons', { defaultValue: 'All Persons' })}</Button>
        <Button onClick={onSmartFilters}>{t('charts.smartFilters', { defaultValue: 'Smart Filters' })}</Button>
      </div>
      <label className="mb-2 block">
        <div className="mb-1 text-xs text-muted-foreground">{t('charts.find', { defaultValue: 'Find' })}</div>
        <Input compact value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Find person" />
      </label>
      <label className="mb-2.5 block">
        <div className="mb-1 text-xs text-muted-foreground">{t('charts.groupBy', { defaultValue: 'Group by' })}</div>
        <Select
          value={group}
          onChange={onGroupChange}
          options={[
            { value: 'lastName', label: t('charts.lastName', { defaultValue: 'Last Name' }) },
            { value: 'firstName', label: t('editor.person.field.firstName', { defaultValue: 'First Name' }) },
            { value: 'birth', label: t('charts.birthYear', { defaultValue: 'Birth Year' }) },
          ]}
          triggerClassName="h-8 ps-2 text-xs"
        />
      </label>
      <div className="mb-1.5 text-xs text-muted-foreground">{t('charts.personCount', { count: persons.length, formatted: persons.length.toLocaleString(), defaultValue: `${persons.length.toLocaleString()} persons` })}</div>
      <div className="min-h-0 overflow-auto">
        {persons.slice(0, 700).map((person) => {
          const active = person.recordName === rootId;
          return (
            <button
              type="button"
              key={person.recordName}
              onClick={() => onPick(person.recordName)}
              className={cn(
                'mb-1 w-full cursor-pointer rounded-md border border-border px-2 py-1.5 text-start text-foreground',
                active ? 'bg-accent' : 'bg-background hover:bg-accent'
              )}
            >
              <div className="truncate text-xs font-semibold"><BdiText>{person.fullName || person.recordName}</BdiText></div>
              <div className="text-xs text-muted-foreground"><LtrText>{person.birthDate || t('charts.birthUnknown', { defaultValue: 'Birth unknown' })}</LtrText></div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
