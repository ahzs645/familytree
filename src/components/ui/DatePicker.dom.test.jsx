// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DatePicker } from './DatePicker.jsx';

afterEach(cleanup);

describe('DatePicker', () => {
  it('portals its calendar outside overflow-clipped editor panes', () => {
    render(
      <div data-testid="editor-scrollport" style={{ width: 220, height: 80, overflow: 'hidden' }}>
        <DatePicker value="" onChange={() => {}} ariaLabel="Birth date" />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Birth date' }));
    const calendar = screen.getByRole('dialog', { name: 'Choose date' });
    expect(document.body.contains(calendar)).toBe(true);
    expect(screen.getByTestId('editor-scrollport').contains(calendar)).toBe(false);
    expect(calendar.className).toContain('fixed');
  });
});
