// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FilterChip } from './FilterChip.jsx';
import { Switch } from './Switch.jsx';
import { Textarea } from './Input.jsx';

describe('shared UI primitives', () => {
  it('renders an active filter without conflicting neutral utilities', () => {
    render(<FilterChip active>All</FilterChip>);
    const chip = screen.getByRole('button', { name: 'All' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(chip.className).toContain('bg-primary');
    expect(chip.className).toContain('text-primary-foreground');
    expect(chip.className).not.toContain('bg-secondary');
    expect(chip.className).not.toContain('text-secondary-foreground');
  });

  it('keeps the settings switch backed by an accessible checkbox', () => {
    const onChange = vi.fn();
    render(<Switch label="Show private records" checked={false} onChange={onChange} />);
    const checkbox = screen.getByRole('checkbox', { name: 'Show private records' });
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('uses the canonical textarea sizing and resize treatment', () => {
    render(<Textarea aria-label="Notes" />);
    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    expect(textarea.className).toContain('min-h-20');
    expect(textarea.className).toContain('resize-y');
  });
});
