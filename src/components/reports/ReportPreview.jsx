/**
 * Renders a report AST to the DOM for live preview.
 * Mirrors the HTML exporter but styled locally for the app shell.
 */
import React from 'react';
import { BdiText } from '../BdiText.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

export function ReportPreview({ report, zoom = 'fit', emptyLabel = '', pageBreakLabel = '' }) {
  const { t } = useTranslation();
  if (!report) return <div className="p-12 text-center text-muted-foreground">{emptyLabel || t('books.preview.configureForPreview')}</div>;
  const scale = zoom === 'fit' ? 1 : Math.max(0.5, Math.min(2, Number(zoom) || 1));
  const scaled = zoom !== 'fit';
  const breakLabel = pageBreakLabel || t('books.preview.pageBreak');
  // The report preview always renders as a paper page — white/sepia background
  // and dark body text — regardless of the app theme, so it matches what
  // HTML/PDF exports produce. Width, background, and padding are computed from
  // the report's page style, so they stay inline.
  return (
    <div className="mx-auto" style={scaled ? scaledWrapperStyle(report.pageStyle, scale) : undefined}>
      <div
        className="relative mx-auto my-5 overflow-hidden rounded text-start leading-[1.55] shadow-[0_2px_24px_rgba(0,0,0,0.4)]"
        style={{ ...styleFor(report.pageStyle, report.bookTheme, scaled), ...(scaled ? { transform: `scale(${scale})`, transformOrigin: 'top center' } : {}) }}
        lang={report.localization?.locale}
        dir={report.localization?.direction}
      >
        {report.pageStyle?.watermarkText && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[-15%] top-[38%] z-10 rotate-[-32deg] text-center text-6xl font-bold tracking-widest text-[#1a1d27]"
            style={{ opacity: report.pageStyle.watermarkOpacity ?? 0.12 }}
          >
            <BdiText>{report.pageStyle.watermarkText}</BdiText>
          </div>
        )}
        <div className="relative z-0">{report.blocks.map((b, i) => <Block key={i} block={b} pageStyle={report.pageStyle} theme={report.bookTheme} pageBreakLabel={breakLabel} />)}</div>
      </div>
    </div>
  );
}

function Block({ block: b, pageStyle = {}, theme, pageBreakLabel = '' }) {
  const accentStyle = theme?.preview?.accent ? { borderColor: theme.preview.accent, color: theme.preview.accent } : undefined;
  const coverStyle = (b.bookSectionKind === 'cover' || b.bookSectionKind === 'title') && theme?.preview
    ? { background: theme.preview.accent, color: theme.id === 'BlackAndWhite' || theme.id === 'Pure' ? theme.preview.foreground : '#ffffff', padding: 20, borderRadius: 8 }
    : undefined;
  switch (b.kind) {
    case 'title': {
      // The preview is a document nested inside the page, so its headings start
      // one level down — the page's own h1 stays the only h1.
      if (b.level === 1) return <h2 className="mb-2.5 mt-0 text-[28px] font-bold" style={coverStyle}><BdiText>{b.text}</BdiText></h2>;
      if (b.level === 2) return <h3 className="mb-2.5 mt-6 border-b pb-1 text-xl font-semibold" style={accentStyle}><BdiText>{b.text}</BdiText></h3>;
      return <h4 className="mb-2 mt-[18px] text-base font-semibold"><BdiText>{b.text}</BdiText></h4>;
    }
    case 'paragraph':
      return <p className="my-2 text-sm"><BdiText>{b.text}</BdiText></p>;
    case 'list':
      return (
        <ul className="my-2 ps-[22px] text-sm">
          {b.items.map((it, i) => <li key={i}><BdiText>{it}</BdiText></li>)}
        </ul>
      );
    case 'table':
      {
      const grid = pageStyle.tableGridLines || 'horizontal';
      const cellBorder = grid === 'all' ? 'border border-[#c8cad2]' : grid === 'horizontal' ? 'border-b border-[#e5e7ed]' : '';
      return (
        <table className="my-3.5 w-full border-collapse text-sm">
          <thead>
            <tr>{b.columns.map((c) => <th key={c} className={`${cellBorder} px-2 py-1.5 text-start text-xs font-semibold uppercase tracking-[0.3px] text-[#5b6072]`}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i} className={pageStyle.stripeTableRows && i % 2 ? 'bg-[#eef0f4]' : ''}>{r.map((c, j) => <td key={j} className={`${cellBorder} px-2 py-1.5`}><BdiText>{c}</BdiText></td>)}</tr>
            ))}
          </tbody>
        </table>
      );
      }
    case 'pageBreak':
      return <div className="my-[18px] border-y border-dashed border-[#aab] py-2.5 text-center text-xs text-[#aab]">— {pageBreakLabel} —</div>;
    case 'spacer':
      return <div style={{ height: b.size || 12 }} />;
    default:
      return null;
  }
}

function styleFor(pageStyle = {}, bookTheme, fixedWidth = false) {
  // maxWidth is bounded by the preview pane, not the viewport. With
  // `calc(100vw - 48px)` the page could be wider than the pane it sits in, and
  // because the page is centred with `margin: auto` the overflow lands outside
  // the scrollable range — in RTL that put the last table column at a negative
  // offset, clipped and unreachable.
  const maxWidth = fixedWidth ? undefined : '100%';
  const size = pageStyle.pageSize === 'a4'
    ? { width: 794, maxWidth }
    : pageStyle.pageSize === 'legal'
      ? { width: pageStyle.orientation === 'landscape' ? 1344 : 816, maxWidth }
      : { width: pageStyle.orientation === 'landscape' ? 1056 : 816, maxWidth };
  const background = bookTheme?.preview?.background || (pageStyle.background === 'sepia'
    ? '#fbf6e8'
    : pageStyle.background === 'soft'
      ? '#f7f8fb'
      : '#fff');
  return {
    ...size,
    background,
    color: bookTheme?.preview?.foreground || '#1a1d27',
    padding: Math.max(24, Math.min(96, pageStyle.margin || 48)),
  };
}

function scaledWrapperStyle(pageStyle = {}, scale) {
  const baseWidth = pageStyle.pageSize === 'a4' ? 794 : pageStyle.pageSize === 'legal' ? (pageStyle.orientation === 'landscape' ? 1344 : 816) : (pageStyle.orientation === 'landscape' ? 1056 : 816);
  return { width: baseWidth * scale, minHeight: 400 * scale };
}

export default ReportPreview;
