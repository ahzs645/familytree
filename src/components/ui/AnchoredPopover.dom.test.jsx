// @vitest-environment jsdom
import React, { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AnchoredPopover } from './AnchoredPopover.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

function Harness({ align = 'start', direction = 'ltr', onInsideMouseDown }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  return (
    <div data-testid="clipper" style={{ width: 100, height: 60, overflow: 'hidden' }}>
      <button
        ref={anchorRef}
        type="button"
        style={{ direction }}
        onClick={() => setOpen((value) => !value)}
      >
        Open
      </button>
      {open ? (
        <AnchoredPopover
          anchorRef={anchorRef}
          align={align}
          maxHeight={300}
          data-testid="popover"
          className="w-60"
        >
          <button type="button" onMouseDown={onInsideMouseDown}>Inside</button>
        </AnchoredPopover>
      ) : null}
    </div>
  );
}

function mockPopoverSize({ width = 240, height = 120 } = {}) {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function getWidth() {
    return this.dataset?.testid === 'popover' ? width : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function getHeight() {
    return this.dataset?.testid === 'popover' ? height : 0;
  });
}

describe('AnchoredPopover', () => {
  it('portals outside an overflow container and follows the trigger on scroll', () => {
    mockPopoverSize();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    let left = 24;
    trigger.getBoundingClientRect = () => rect({ top: 100, left, width: 100, height: 30 });

    fireEvent.click(trigger);
    const popover = screen.getByTestId('popover');
    expect(document.body.contains(popover)).toBe(true);
    expect(screen.getByTestId('clipper').contains(popover)).toBe(false);
    expect(popover.className).toContain('fixed');
    expect(popover.style.left).toBe('24px');
    expect(popover.style.top).toBe('134px');

    left = 72;
    fireEvent.scroll(window);
    expect(popover.style.left).toBe('72px');
  });

  it('clamps to the viewport and flips above when there is more room', () => {
    mockPopoverSize({ width: 240, height: 180 });
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(500);
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.getBoundingClientRect = () => rect({ top: 440, left: 350, width: 40, height: 30 });

    fireEvent.click(trigger);
    const popover = screen.getByTestId('popover');
    expect(popover.style.left).toBe('152px');
    expect(popover.style.top).toBe('256px');
    expect(popover.dataset.placement).toBe('top');
  });

  it('uses logical start alignment in RTL', () => {
    mockPopoverSize({ width: 240, height: 80 });
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(500);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(500);
    render(<Harness direction="rtl" />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.getBoundingClientRect = () => rect({ top: 40, left: 300, width: 40, height: 30 });

    fireEvent.click(trigger);
    expect(screen.getByTestId('popover').style.left).toBe('100px');
  });

  it('keeps inside presses away from document click-away listeners', () => {
    mockPopoverSize();
    const documentMouseDown = vi.fn();
    const insideMouseDown = vi.fn();
    document.addEventListener('mousedown', documentMouseDown);
    render(<Harness onInsideMouseDown={insideMouseDown} />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.getBoundingClientRect = () => rect({ top: 40, left: 40, width: 100, height: 30 });
    fireEvent.click(trigger);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Inside' }));
    expect(insideMouseDown).toHaveBeenCalledTimes(1);
    expect(documentMouseDown).not.toHaveBeenCalled();
    document.removeEventListener('mousedown', documentMouseDown);
  });
});
