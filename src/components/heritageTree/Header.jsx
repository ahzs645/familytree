import React, { useRef } from 'react';
import Tooltip from './Tooltip.jsx';
import { exportTreeToPdf } from './exportTree.js';
import BdiText from '../BdiText.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

const THEME_KEYS = ['classic', 'dark', 'ocean', 'forest', 'monochrome'];

export default function Header({
  maxGen,
  rootName,
  searchTerm,
  setSearchTerm,
  filteredIndividuals,
  rootId,
  setSelectedRootId,
  theme,
  setTheme,
  handleFileUpload,
  setShowAnalytics,
  view,
  setView,
  handleRecenter,
  handleResetToDatasetDefault,
  handleHardReset
}) {
  const fileInputRef = useRef(null);
  const { t } = useTranslation();

  return (
    <header>
      <div className="heritage-title-block">
        <h1>{t('heritageTree.title')}</h1>
        <p>
          {rootName
            ? <>{t('heritageTree.subtitleForRoot', { count: maxGen })} <BdiText>{rootName}</BdiText></>
            : t('heritageTree.subtitle', { count: maxGen })}
        </p>
      </div>
      <div className="controls">
        <Tooltip text={t('heritageTree.tooltips.search')}>
          <div className="heritage-search-control">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" style={{ color: 'var(--gold)' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              className="search-input"
              type="text" 
              placeholder={t('heritageTree.searchPlaceholder')}
              title={t('heritageTree.searchTitle')}
              aria-label={t('heritageTree.searchAria')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredIndividuals.length > 0) {
                  setSelectedRootId(filteredIndividuals[0].id);
                  setSearchTerm('');
                  e.target.blur(); // Drops focus so the dropdown hides
                }
              }}
            />
            <div className="heritage-control-separator"></div>
            <select 
              value={searchTerm ? 'search_prompt' : (rootId || '')} 
              aria-label={t('heritageTree.selectRootAria')}
              onChange={(e) => { 
                if (e.target.value !== 'search_prompt') {
                  setSelectedRootId(e.target.value); 
                  setSearchTerm(''); 
                }
              }}
              className="heritage-root-select"
            >
              {searchTerm && filteredIndividuals.length > 0 && <option value="search_prompt" disabled>{t('heritageTree.searchResults', { count: filteredIndividuals.length })}</option>}
              {filteredIndividuals.length === 0 && <option value="search_prompt" disabled>{t('heritageTree.noResults')}</option>}
              {filteredIndividuals.map(ind => (
                <option key={ind.id} value={ind.id}>{ind.name}</option>
              ))}
            </select>
          </div>
        </Tooltip>
        <Tooltip text={t('heritageTree.tooltips.theme')}>
          <select 
            value={theme} 
            aria-label={t('heritageTree.themeAria')}
            onChange={(e) => setTheme(e.target.value)}
            className="heritage-theme-select"
          >
            {THEME_KEYS.map((key) => (
              <option key={key} value={key}>{t(`heritageTree.themes.${key}`)}</option>
            ))}
          </select>
        </Tooltip>
        {handleFileUpload && (
          <>
            <input type="file" accept=".ged" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
            <Tooltip text={t('heritageTree.tooltips.upload')}>
              <button className="btn" aria-label={t('heritageTree.uploadAria')} onClick={() => fileInputRef.current?.click()}>
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              </button>
            </Tooltip>
          </>
        )}
        <Tooltip text={t('heritageTree.tooltips.exportPdf')}>
          <button className="btn" aria-label={t('heritageTree.exportPdfAria')} onClick={() => exportTreeToPdf()}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          </button>
        </Tooltip>
        <Tooltip text={t('heritageTree.tooltips.analytics')}>
          <button className="btn" aria-label={t('heritageTree.analyticsAria')} onClick={() => setShowAnalytics(true)}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          </button>
        </Tooltip>
        <Tooltip text={t('heritageTree.tooltips.zoomOut')}>
          <button className="btn" aria-label={t('heritageTree.zoomOutAria')} onClick={() => setView(prev => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.12) }))}>−</button>
        </Tooltip>
        <span className="zoom-label">{Math.round(view.scale * 100)}%</span>
        <Tooltip text={t('heritageTree.tooltips.zoomIn')}>
          <button className="btn" aria-label={t('heritageTree.zoomInAria')} onClick={() => setView(prev => ({ ...prev, scale: Math.min(2, prev.scale + 0.12) }))}>+</button>
        </Tooltip>
        <div className="heritage-toolbar-separator"></div>
        <Tooltip text={t('heritageTree.tooltips.recenter')}>
          <button className="btn" aria-label={t('heritageTree.recenterAria')} onClick={handleRecenter}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
        </Tooltip>
        <Tooltip text={t('heritageTree.tooltips.resetRoot')}>
          <button className="btn" aria-label={t('heritageTree.resetRootAria')} onClick={handleResetToDatasetDefault}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </button>
        </Tooltip>
        <Tooltip text={t('heritageTree.tooltips.reload')}>
          <button className="btn" aria-label={t('heritageTree.reloadAria')} onClick={handleHardReset}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
