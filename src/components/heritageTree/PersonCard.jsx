import React, { useState, useEffect } from 'react';
import { originLabels } from './constants.js';

export default function PersonCard({ person, isRoot, isDimmed, onClick, onMouseEnter, onMouseLeave }) {
  const [imgError, setImgError] = useState(false);

  const photoUrl = person.photoUrl || null;

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
          alt={`Portrait of ${person.name}`} 
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
        <div className="hidden-indicator" title="Click to reveal hidden relatives">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
      )}
      <div className="name">{person.name}</div>
      { (person.birth || person.death) && (
        <div className="dates">
          {person.birth && `b. ${person.birth}`}<br />
          {person.death && `d. ${person.death}`}
        </div>
      )}
      { (person.place || person.deathPlace) && <div className="place">{person.place || person.deathPlace}</div> }
      
      { person.origin === 'dual' ? (
        <div title="Geographic Origin (Birthplace / Residence)">
          <span className="origin-tag origin-polish">Poland</span>
          <span className="origin-note">subject of Austro-Hungarian Empire</span>
        </div>
      ) : person.origin ? (
        <span className={`origin-tag origin-${person.origin}`} title="Geographic Origin (Birthplace / Residence)">{originLabels[person.origin] || person.origin}</span>
      ) : null }
    </div>
  );
}
