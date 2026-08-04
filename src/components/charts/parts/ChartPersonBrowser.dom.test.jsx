// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChartPersonBrowser } from './ChartPersonBrowser.jsx';

vi.mock('../../../contexts/LocalizationContext.jsx', () => ({
  useTranslation: () => ({
    t: (key, params = {}) => ({
      'charts.allPersons': 'All Persons',
      'charts.smartFilters': 'Smart Filters',
      'charts.find': 'Find',
      'charts.browsePeopleHint': 'Select a person to inspect them.',
      'charts.groupBy': 'Group by',
      'charts.lastName': 'Last Name',
      'editor.person.field.firstName': 'First Name',
      'charts.birthYear': 'Birth Year',
      'charts.birthUnknown': 'Birth unknown',
      'charts.personCount': `${params.count || 0} persons`,
    })[key] || key,
  }),
}));

afterEach(cleanup);

describe('ChartPersonBrowser', () => {
  it('opens the chosen person for inspection instead of implicitly rerooting', () => {
    const person = { recordName: 'person-1', fullName: 'Ada Example', birthDate: '1900' };
    const onPick = vi.fn();
    render(
      <ChartPersonBrowser
        persons={[person]}
        rootId="person-2"
        query=""
        onQueryChange={() => {}}
        group="lastName"
        onGroupChange={() => {}}
        onPick={onPick}
        onAllPersons={() => {}}
        onSmartFilters={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Ada Example/ }));
    expect(onPick).toHaveBeenCalledWith(person);
    expect(screen.getByText('Select a person to inspect them.')).toBeTruthy();
  });
});
