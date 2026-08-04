// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TreeSwitcher } from './TreeSwitcher.jsx';

vi.mock('../lib/treeLibrary.js', () => ({
  ACTIVE_TREE_CHANGED_EVENT: 'active-tree-changed',
  TREES_CHANGED_EVENT: 'trees-changed',
  getActiveTreeId: () => 'tree-1',
  listTreeSnapshots: async () => [{
    id: 'tree-1',
    name: "Ahmad's Family (Arabic)",
    recordCount: 6598,
    favorite: false,
    artwork: { mode: 'crest', crest: 'tree' },
  }],
  switchToTree: vi.fn(),
  normalizeTreeArtwork: (artwork) => ({ mode: 'crest', crest: 'tree', ...artwork }),
  getTreeArtworkMedia: async () => [],
  setTreeSnapshotArtwork: vi.fn(),
}));

vi.mock('../contexts/DatabaseStatusContext.jsx', () => ({
  useDatabaseStatus: () => ({ refresh: vi.fn() }),
}));

vi.mock('../contexts/LocalizationContext.jsx', () => ({
  useTranslation: () => ({
    t: (key, options) => options?.defaultValue || key,
  }),
}));

afterEach(cleanup);

describe('TreeSwitcher', () => {
  it('renders its menu outside the clipped sidebar in expanded and collapsed modes', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <aside data-testid="sidebar" style={{ width: 240, overflow: 'hidden' }}>
          <TreeSwitcher />
        </aside>
      </MemoryRouter>,
    );
    await screen.findByText("Ahmad's Family (Arabic)");
    fireEvent.click(screen.getByRole('button', { name: 'Switch family tree' }));

    let menu = screen.getByRole('listbox');
    expect(document.body.contains(menu)).toBe(true);
    expect(screen.getByTestId('sidebar').contains(menu)).toBe(false);
    expect(menu.className).toContain('fixed');
    expect(screen.getByText('6598')).toBeTruthy();

    rerender(
      <MemoryRouter>
        <aside data-testid="sidebar" style={{ width: 56, overflow: 'hidden' }}>
          <TreeSwitcher collapsed />
        </aside>
      </MemoryRouter>,
    );
    menu = screen.getByRole('listbox');
    expect(screen.getByTestId('sidebar').contains(menu)).toBe(false);
  });
});
