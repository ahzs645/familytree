import React, { useState, useEffect } from 'react';
import { originLabels } from './constants.js';
import { formatVitalDateParts } from '../../lib/vitalFormat.js';
import BdiText from '../BdiText.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

export default function PersonCard({ person, isRoot, isDimmed, onClick, onMouseEnter, onMouseLeave }) {
  const [imgError, setImgError] = useState(false);
  const { t } = useTranslation();

  const photoUrl = person.photoUrl || null;
  const vitalParts = formatVitalDateParts({ birthDate: person.birth, deathDate: person.death });

  // Reset image error state when the person (and thus photoUrl) changes
  useEffect(() => {
    setImgError(false);
  }, [photoUrl]);

  return (
    <div 
      className={`card ${isRoot ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''} ${photoUrl && !imgError ? 'has-photo' : ''}`}
      style={{ left: person.x, top: person.y }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {photoUrl && !imgError ? (
        <img 
          src={photoUrl} 
          alt={t('heritageTree.portraitAlt', { name: person.name })}
          className="headshot" 
          onError={(e) => {
            setImgError(true);
          }} 
        />
      ) : (
        <div className="headshot-fallback">
          <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
      )}
      {person.hasHiddenRelations && (
        <div className="hidden-indicator" title={t('heritageTree.hiddenRelations')}>
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
      )}
      <div className="name"><BdiText>{person.name}</BdiText></div>
      { vitalParts.length > 0 && (
        <div className="dates">
          {vitalParts.map((part) => <React.Fragment key={part}><BdiText>{part}</BdiText><br /></React.Fragment>)}
        </div>
      )}
      { (person.place || person.deathPlace) && <div className="place"><BdiText>{person.place || person.deathPlace}</BdiText></div> }
      
      { person.origin ? (
        <span className={`origin-tag origin-${person.origin}`} title={t('heritageTree.originTitle')}>{originLabels[person.origin] || person.origin}</span>
      ) : null }
    </div>
  );
}
