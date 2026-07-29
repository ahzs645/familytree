// @vitest-environment jsdom
import React, { useEffect, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Select } from './Select.jsx';

afterEach(cleanup);

const options = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two' },
  { value: 'three', label: 'Three' },
];

function rect({ top, left, width, height }) {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {},
  };
}

describe('Select', () => {
  it('portals its listbox outside an overflow container and commits a choice', () => {
    const onChange = vi.fn();
    const { container } = render(
      <div data-testid="scroll-container" style={{ overflowY: 'auto', maxHeight: 100 }}>
        <Select value="one" onChange={onChange} options={options} ariaLabel="Example" />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Example' }));
    const listbox = screen.getByRole('listbox');
    expect(document.body.contains(listbox)).toBe(true);
    expect(container.contains(listbox)).toBe(false);
    expect(listbox.className).toContain('fixed');

    fireEvent.mouseDown(screen.getByRole('option', { name: 'Two' }));
    fireEvent.click(screen.getByRole('option', { name: 'Two' }));
    expect(onChange).toHaveBeenCalledWith('two');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('does not trigger a nesting popover click-away handler when choosing an option', () => {
    const onChange = vi.fn();

    function NestedPopover() {
      const rootRef = useRef(null);
      const [visible, setVisible] = useState(true);

      useEffect(() => {
        const closeOnOutsideMouseDown = (event) => {
          if (!rootRef.current?.contains(event.target)) setVisible(false);
        };
        document.addEventListener('mousedown', closeOnOutsideMouseDown);
        return () => document.removeEventListener('mousedown', closeOnOutsideMouseDown);
      }, []);

      return (
        <div ref={rootRef}>
          {visible ? <Select value="one" onChange={onChange} options={options} ariaLabel="Nested" /> : null}
        </div>
      );
    }

    render(<NestedPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Nested' }));
    const option = screen.getByRole('option', { name: 'Three' });
    fireEvent.mouseDown(option);
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith('three');
    expect(screen.getByRole('button', { name: 'Nested' })).toBeTruthy();
  });

  it('places the menu above the trigger when there is not enough room below', () => {
    render(<Select value="one" onChange={() => {}} options={options} ariaLabel="Placement" />);
    const trigger = screen.getByRole('button', { name: 'Placement' });
    trigger.getBoundingClientRect = () => rect({ top: 700, left: 100, width: 180, height: 32 });

    fireEvent.click(trigger);
    const listbox = screen.getByRole('listbox');

    expect(Number.parseFloat(listbox.style.top)).toBeLessThan(700);
    expect(listbox.style.left).toBe('100px');
    expect(listbox.style.minWidth).toBe('180px');
  });

  it('tracks the trigger when a nested scroll container moves it', () => {
    let triggerTop = 200;
    render(<Select value="one" onChange={() => {}} options={options} ariaLabel="Scrolling" />);
    const trigger = screen.getByRole('button', { name: 'Scrolling' });
    trigger.getBoundingClientRect = () => rect({ top: triggerTop, left: 40, width: 160, height: 32 });

    fireEvent.click(trigger);
    const listbox = screen.getByRole('listbox');
    expect(listbox.style.top).toBe('236px');

    triggerTop = 120;
    fireEvent.scroll(window);
    expect(listbox.style.top).toBe('156px');
  });
});
