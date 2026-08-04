// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChartBottomToolbar } from './ChartBottomToolbar.jsx';

vi.mock('../../../contexts/LocalizationContext.jsx', () => ({
  useTranslation: () => ({
    t: (key, params = {}) => ({
      'charts.focus': 'Focus',
      'common.save': 'Save',
      'charts.share': 'Share',
      'charts.browsePeople': 'Browse people',
      'charts.options': 'Options',
      'charts.tab.export': 'Export',
    })[key] || params.defaultValue || key,
  }),
}));

afterEach(cleanup);

describe('ChartBottomToolbar', () => {
  it('offers the people browser without duplicating the root-person search', () => {
    const onTogglePersonBrowser = vi.fn();
    render(
      <ChartBottomToolbar
        personBrowserOpen={false}
        onTogglePersonBrowser={onTogglePersonBrowser}
        onFocus={() => {}}
        onSave={() => {}}
        onShare={() => {}}
        onExport={() => {}}
        onChart={() => {}}
        chartOptionsOpen={false}
      />
    );

    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Browse people' }));
    expect(onTogglePersonBrowser).toHaveBeenCalledOnce();
  });
});
