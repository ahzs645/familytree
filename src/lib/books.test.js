import { describe, expect, it } from 'vitest';
import { compileBook } from './books.js';

describe('book compilation', () => {
  it('materializes cover metadata and a numbered table of contents', async () => {
    const report = await compileBook({
      title: 'Family Book',
      sections: [
        {
          kind: 'cover',
          text: 'Family Book',
          subtitle: 'A shared history',
          author: 'A. Historian',
          date: '2026',
          publisher: 'Family Archive',
        },
        { kind: 'toc', tocStyle: 'numbered' },
        { kind: 'title', text: 'Chapter One', subtitle: 'Beginnings' },
      ],
    });

    expect(report.title).toBe('Family Book');
    expect(report.blocks).toContainEqual({ kind: 'title', text: 'Family Book', level: 1 });
    expect(report.blocks).toContainEqual({ kind: 'paragraph', text: 'A shared history' });
    expect(report.blocks).toContainEqual({
      kind: 'list',
      items: ['Author: A. Historian', 'Date: 2026', 'Publisher: Family Archive'],
    });
    expect(report.blocks).toContainEqual({ kind: 'title', text: 'Table of Contents', level: 2 });
    expect(report.blocks).toContainEqual({ kind: 'list', items: ['1. Family Book', '3. Chapter One'] });
  });

  it('supports compact table of contents output', async () => {
    const report = await compileBook({
      title: 'Compact Book',
      sections: [
        { kind: 'title', text: 'One' },
        { kind: 'toc', tocStyle: 'compact' },
        { kind: 'title', text: 'Two' },
      ],
    });

    expect(report.blocks).toContainEqual({ kind: 'paragraph', text: '1. One · 3. Two' });
  });
});
