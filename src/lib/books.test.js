import { describe, expect, it } from 'vitest';
import { compileBook, normalizeBookPresentationSettings } from './books.js';

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

  it('compiles chapter sections with numbering and notes', async () => {
    const report = await compileBook({
      title: 'Chaptered Book',
      sections: [
        { kind: 'chapter', text: 'Origins', subtitle: 'Early family lines', chapterType: 'content', chapterNumber: '1', note: 'Draft chapter.' },
        { kind: 'toc', tocStyle: 'plain' },
        { kind: 'chapter', text: 'Records', chapterType: 'appendix' },
      ],
    });

    expect(report.blocks).toContainEqual({ kind: 'title', text: '1. Origins', level: 1 });
    expect(report.blocks).toContainEqual({ kind: 'paragraph', text: 'Early family lines' });
    expect(report.blocks).toContainEqual({ kind: 'paragraph', text: 'Draft chapter.' });
    expect(report.blocks).toContainEqual({ kind: 'list', items: ['1. Origins', 'Records'] });
  });

  it('applies shared presentation settings to compiled book output', async () => {
    const report = await compileBook({
      title: 'Styled Book',
      presentationSettings: {
        pageStyle: { paginate: false, background: 'sepia', pageSize: 'a4', orientation: 'landscape', margin: 72 },
      },
      sections: [
        { kind: 'title', text: 'One' },
        { kind: 'title', text: 'Two' },
      ],
    });

    expect(report.pageStyle).toEqual({ paginate: false, background: 'sepia', pageSize: 'a4', orientation: 'landscape', margin: 72 });
    expect(report.blocks.some((entry) => entry.kind === 'pageBreak')).toBe(false);
  });

  it('keeps book section pagination on by default for old saved books', () => {
    expect(normalizeBookPresentationSettings().pageStyle).toMatchObject({ paginate: true });
  });
});
