/**
 * Lazy loader for sql.js (SQLite compiled to WebAssembly).
 *
 * Both `sql-wasm.js` and `sql-wasm.wasm` are served from /public so the
 * app stays fully local — no CDN. The WASM file path is computed at
 * runtime from the document's <base href> (or Vite's BASE_URL) so the
 * loader works under sub-path deployments like GitHub Pages.
 */

let _SQL = null;

function basePath() {
  return document.querySelector('base')?.href || import.meta.env?.BASE_URL || '/';
}

export async function getSqlJs() {
  if (_SQL) return _SQL;

  if (!window.initSqlJs) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = basePath() + 'sql-wasm.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load sql-wasm.js'));
      document.head.appendChild(script);
    });
  }

  _SQL = await window.initSqlJs({
    locateFile: () => basePath() + 'sql-wasm.wasm',
  });
  return _SQL;
}
