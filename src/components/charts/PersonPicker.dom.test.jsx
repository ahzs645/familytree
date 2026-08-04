// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PersonPicker } from './PersonPicker.jsx';

vi.mock('../../contexts/LocalizationContext.jsx', () => ({
  useTranslation: () => ({
    t: (key) => ({
      'persons.choosePerson': 'Choose person...',
      'persons.search': 'Search...',
      'persons.searchPicker': 'Search person choices',
      'persons.searchPlaceholder': 'Search persons...',
      'common.noMatches': 'No matches',
    })[key] || key,
  }),
}));

afterEach(cleanup);

const persons = [
  { recordName: 'person-1', fullName: 'Ada Example', birthDate: '1900', deathDate: '1980' },
  { recordName: 'person-2', fullName: 'Grace Example', birthDate: '1910', deathDate: '1990' },
];

describe('PersonPicker', () => {
  it('exposes a labelled listbox with keyboard-operable options', () => {
    const onChange = vi.fn();
    render(
      <PersonPicker
        persons={persons}
        value=""
        onChange={onChange}
        ariaLabel="Relationships relative to"
        placeholder="Choose reference person..."
      />
    );

    const trigger = screen.getByRole('button', { name: 'Relationships relative to' });
    expect(trigger.textContent).toContain('Choose reference person...');
    fireEvent.click(trigger);

    const listbox = screen.getByRole('listbox', { name: 'Relationships relative to' });
    expect(trigger.getAttribute('aria-controls')).toBe(listbox.id);

    const option = screen.getByRole('option', { name: /Ada Example/ });
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('person-1');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes the picker and returns focus to its trigger on Escape', () => {
    render(<PersonPicker persons={persons} value="" onChange={() => {}} ariaLabel="Person" />);
    const trigger = screen.getByRole('button', { name: 'Person' });
    fireEvent.click(trigger);

    const search = screen.getByRole('textbox', { name: 'Search person choices' });
    fireEvent.keyDown(search, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
