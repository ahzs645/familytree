import React, { useState, useMemo } from 'react';
import DonutChart from './DonutChart.jsx';
import SegmentedBarChart from './SegmentedBarChart.jsx';
import { originLabels, originColors } from './constants.js';

export default function AnalyticsModal({ show, onClose, indis, nodes, fams, rootId }) {
  const [isFullData, setIsFullData] = useState(false);

  const dataSource = useMemo(() => {
    return isFullData ? Object.values(indis || {}) : (nodes || []);
  }, [isFullData, indis, nodes]);

  const longevityData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const peopleWithLifespan = dataSource.map(p => {
      if (!p.birth) return null;
      // Extract 4 digit year from potentially messy GEDCOM date strings
      const bMatch = p.birth.match(/\d{4}/);
      
      if (!bMatch) return null;
      const bYear = parseInt(bMatch[0], 10);
      
      let dYear;
      let isLiving = false;
      if (p.death) {
        const dMatch = p.death.match(/\d{4}/);
        if (!dMatch) return null;
        dYear = parseInt(dMatch[0], 10);
      } else {
        dYear = currentYear;
        isLiving = true;
      }

      const age = dYear - bYear;
      
      // Filter out negative ages or crazy outliers
      // Also filter out "living" people over 110 (likely deceased but missing a death date)
      if (age < 0 || age > 120 || (isLiving && age > 110)) return null; 

      return { name: p.name, age, bYear, dYear, isLiving };
    }).filter(Boolean);

    return peopleWithLifespan.sort((a, b) => b.age - a.age).slice(0, 5);
  }, [dataSource]);

  const originsData = useMemo(() => {
    const counts = {};
    let totalScore = 0;
    
    dataSource.forEach(p => {
      if (!p.isDummy && p.heritage) {
        Object.entries(p.heritage).forEach(([org, pct]) => {
          if (org !== 'untraced' && pct > 0) {
            counts[org] = (counts[org] || 0) + pct;
            totalScore += pct;
          }
        });
      }
    });
    
    if (totalScore === 0) return [];

    const sorted = Object.entries(counts)
      .map(([origin, score]) => {
        const exactPct = (score / totalScore) * 100;
        return {
          origin, label: originLabels[origin] || origin, percentage: exactPct < 1 ? '<1' : Math.round(exactPct), exactPct
        };
      })
      .sort((a, b) => b.exactPct - a.exactPct);
      
    let cumulative = 0;
    return sorted.map(o => {
      const offset = cumulative;
      cumulative += o.exactPct;
      return { ...o, offset };
    });
  }, [dataSource]);

  const treeHealth = useMemo(() => {
    const realPeople = dataSource.filter(p => !p.isDummy);
    const total = realPeople.length;
    if (total === 0) return { total: 0, withBirthPct: 0, withPlacePct: 0, avgLifespan: 0 };

    let withBirth = 0;
    let withPlace = 0;
    let totalLifespan = 0;
    let lifespanCount = 0;

    realPeople.forEach(p => {
      if (p.birth) withBirth++;
      if (p.place || p.deathPlace) withPlace++;

      if (p.birth && p.death) {
        const bMatch = p.birth.match(/\d{4}/);
        const dMatch = p.death.match(/\d{4}/);
        if (bMatch && dMatch) {
          const age = parseInt(dMatch[0], 10) - parseInt(bMatch[0], 10);
          if (age >= 0 && age <= 120) {
            totalLifespan += age;
            lifespanCount++;
          }
        }
      }
    });

    return {
      total,
      withBirthPct: Math.round((withBirth / total) * 100),
      withPlacePct: Math.round((withPlace / total) * 100),
      avgLifespan: lifespanCount > 0 ? Math.round(totalLifespan / lifespanCount) : 0
    };
  }, [dataSource]);

  const namesData = useMemo(() => {
    const firstNames = {};
    const lastNames = {};

    dataSource.forEach(p => {
      if (p.isDummy) return;
      
      if (p.given) {
        const first = p.given.split(/\s+/)[0];
        if (first && first.length > 1 && first.toLowerCase() !== 'unknown' && first.toLowerCase() !== 'private') {
          firstNames[first] = (firstNames[first] || 0) + 1;
        }
      }
      if (p.surname) {
        const last = p.surname;
        if (last && !last.includes('?') && last.toLowerCase() !== 'unknown' && last.toLowerCase() !== 'private') {
          lastNames[last] = (lastNames[last] || 0) + 1;
        }
      }
    });

    const topFirst = Object.entries(firstNames).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topLast = Object.entries(lastNames).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { topFirst, topLast };
  }, [dataSource]);

  const familyDynamics = useMemo(() => {
    const activeIndiIds = new Set(dataSource.map(p => p.id));
    
    let totalChildren = 0;
    let familiesWithChildren = 0;
    let largestFamily = { parents: 'None', count: 0 };
    
    let totalGenerationGap = 0;
    let gapCount = 0;

    Object.values(fams || {}).forEach(fam => {
      if (!isFullData) {
        // If viewing specific tree, only count families where at least one member is visible
        const hasHusband = fam.husb && activeIndiIds.has(fam.husb);
        const hasWife = fam.wife && activeIndiIds.has(fam.wife);
        const hasChild = fam.chil.some(cId => activeIndiIds.has(cId));
        if (!hasHusband && !hasWife && !hasChild) return;
      }

      const realChildren = fam.chil.filter(cId => indis[cId] && !indis[cId].isDummy);
      
      if (realChildren.length > 0) {
        totalChildren += realChildren.length;
        familiesWithChildren++;

        if (realChildren.length > largestFamily.count) {
          const hName = fam.husb && indis[fam.husb] ? indis[fam.husb].name.replace(/[()]/g, '').trim() : '';
          const wName = fam.wife && indis[fam.wife] ? indis[fam.wife].name.replace(/[()]/g, '').trim() : '';
          
          const hParts = hName.split(' ');
          const wParts = wName.split(' ');
          const hFirst = hParts[0] || '';
          const hLast = hParts.length > 1 ? hParts[hParts.length - 1] : '';
          const wFirst = wParts[0] || '';
          
          let parentsStr = (hFirst && wFirst && hLast) ? `${hFirst} & ${wFirst} ${hLast}` : [hName, wName].filter(Boolean).join(' & ');
          largestFamily = { parents: parentsStr || 'Unknown', count: realChildren.length };
        }

        const getYear = (dateStr) => {
          const m = dateStr ? dateStr.match(/\d{4}/) : null;
          return m ? parseInt(m[0], 10) : null;
        };

        const hBirth = fam.husb && indis[fam.husb] ? getYear(indis[fam.husb].birth) : null;
        const wBirth = fam.wife && indis[fam.wife] ? getYear(indis[fam.wife].birth) : null;
        
        realChildren.forEach(cId => {
          const cBirth = getYear(indis[cId]?.birth);
          if (cBirth) {
            if (hBirth && cBirth - hBirth >= 12 && cBirth - hBirth <= 80) { totalGenerationGap += (cBirth - hBirth); gapCount++; }
            if (wBirth && cBirth - wBirth >= 12 && cBirth - wBirth <= 60) { totalGenerationGap += (cBirth - wBirth); gapCount++; }
          }
        });
      }
    });

    return {
      averageSize: familiesWithChildren > 0 ? (totalChildren / familiesWithChildren).toFixed(1) : 0,
      largestFamily,
      averageGap: gapCount > 0 ? Math.round(totalGenerationGap / gapCount) : 0
    };
  }, [dataSource, fams, indis, isFullData]);

  const namesakesData = useMemo(() => {
    const activeIds = new Set(dataSource.map(p => p.id));
    
    // Helper to extract only given names
    const getGivenNames = (p) => {
      if (!p || !p.given) return [];
      return p.given.toLowerCase().split(/\s+/).filter(n => n.length > 2 && n !== 'nee');
    };

    const formatName = (name) => name ? name.replace(/\//g, '').trim() : 'Unknown';

    const maximalChains = [];
    let namesakesCount = 0;

    dataSource.forEach(p => {
      if (p.isDummy) return;
      const pNames = getGivenNames(p);
      
      // 1. Count Direct Namesakes
      let isNamesake = false;
      if (p.famc.length > 0) {
        const fam = fams[p.famc[0]];
        if (fam) {
          const dad = indis[fam.husb];
          const mom = indis[fam.wife];
          const parentNames = new Set([
            ...(dad ? getGivenNames(dad) : []),
            ...(mom ? getGivenNames(mom) : [])
          ]);
          if (pNames.some(n => parentNames.has(n))) isNamesake = true;
        }
      }
      if (isNamesake) namesakesCount++;

      // 2. Trace Longest Name Chains
      pNames.forEach(nameStr => {
        // Only start a chain if the parent DOESN'T have the name (so we only track from the originator)
        let parentHasIt = false;
        if (p.famc.length > 0) {
          const fam = fams[p.famc[0]];
          if (fam) {
            const dad = indis[fam.husb];
            const mom = indis[fam.wife];
            if (dad && activeIds.has(dad.id) && getGivenNames(dad).includes(nameStr)) parentHasIt = true;
            if (mom && activeIds.has(mom.id) && getGivenNames(mom).includes(nameStr)) parentHasIt = true;
          }
        }

        if (!parentHasIt) {
          const dfs = (currId, currentPath) => {
            const currPerson = indis[currId];
            let passedDown = false;
            currPerson.fams.forEach(fId => {
              const fam = fams[fId];
              if (fam) {
                fam.chil.forEach(cId => {
                  if (activeIds.has(cId) && !indis[cId].isDummy) {
                    if (getGivenNames(indis[cId]).includes(nameStr)) {
                      passedDown = true;
                      dfs(cId, [...currentPath, indis[cId]]);
                    }
                  }
                });
              }
            });
            if (!passedDown && currentPath.length > 1) {
              maximalChains.push({ name: nameStr.charAt(0).toUpperCase() + nameStr.slice(1), path: currentPath.map(x => formatName(x.name)) });
            }
          };
          dfs(p.id, [p]);
        }
      });
    });

    // Sort by length of the chain (longest first)
    maximalChains.sort((a, b) => b.path.length - a.path.length || a.name.localeCompare(b.name));
    return { namesakesCount, topChains: maximalChains.slice(0, 5) };
  }, [dataSource, fams, indis]);

  const rootHeritageData = useMemo(() => {
    const rootPerson = indis ? indis[rootId] : null;
    if (!rootPerson || !rootPerson.heritage) return null;
    
    // Filter out the untraced noise to show only known immigrant heritage
    let totalKnown = 0;
    const knownOrigins = Object.entries(rootPerson.heritage).filter(([org, pct]) => org !== 'untraced' && pct > 0);
    knownOrigins.forEach(([org, pct]) => totalKnown += pct);

    if (totalKnown === 0) {
      return { person: rootPerson, slices: [], desc: "Not enough historical immigrant data in the family tree to calculate a heritage breakdown." };
    }

    const sorted = knownOrigins
      .map(([origin, pct]) => {
        const exactPct = (pct / totalKnown) * 100; // Recalculate out of 100% known
        return { origin, label: originLabels[origin] || origin, percentage: exactPct < 1 ? '<1' : Math.round(exactPct), exactPct };
      })
      .sort((a, b) => b.exactPct - a.exactPct);

    let cumulative = 0;
    const slices = sorted.map(o => {
      const offset = cumulative;
      cumulative += o.exactPct;
      return { ...o, offset };
    });

    // Build a natural language summary
    const primary = sorted.filter(o => o.exactPct >= 20).map(o => o.label);
    const secondary = sorted.filter(o => o.exactPct > 0 && o.exactPct < 20).map(o => o.label);
    let desc = '';
    const formatList = (list) => list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list[0];
    const firstName = rootPerson.given ? rootPerson.given.split(/\s+/)[0] : rootPerson.name.split(' ')[0];

    if (primary.length > 0) {
      desc += `${firstName} is mostly ${formatList(primary)}`;
      if (secondary.length > 0) desc += `, with ${formatList(secondary)} ancestry.`;
      else desc += ` ancestry.`;
    } else if (secondary.length > 0) {
      desc += `${firstName} has ${formatList(secondary)} ancestry.`;
    }

    return { person: rootPerson, slices, desc };
  }, [indis, rootId]);

  if (!show) return null;

  return (
    <div className="analytics-backdrop" onClick={onClose} onWheel={e => e.stopPropagation()}>
      <div className="analytics-modal" onClick={e => e.stopPropagation()}>
        <div className="analytics-header">
          <h2>Tree Analytics</h2>
          <button className="close-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="analytics-content">
          
          {rootHeritageData && (
            <section className="analytics-section">
              <h3>🧬 {rootHeritageData.person.name}'s Heritage</h3>
              {rootHeritageData.desc && <p style={{ marginBottom: '15px', color: 'var(--ink-light)', fontStyle: 'italic' }}>{rootHeritageData.desc}</p>}
              
              {rootHeritageData.slices.length > 0 && <SegmentedBarChart data={rootHeritageData.slices} colors={originColors} />}
            </section>
          )}

          <section className="analytics-section" style={{ paddingBottom: '15px' }}>
            <h3 style={{ borderBottom: 'none', marginBottom: '5px' }}>📊 Group Insights</h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--ink-light)', fontStyle: 'italic', marginBottom: '15px' }}>
              The statistics below analyze multiple relatives. Select your dataset:
            </p>
            <div style={{ display: 'flex', background: 'var(--card-border)', padding: '4px', borderRadius: '6px' }}>
              <button 
                style={{ flex: 1, padding: '6px 12px', border: 'none', borderRadius: '4px', background: isFullData ? 'var(--card-bg)' : 'transparent', color: isFullData ? 'var(--ink)' : 'var(--ink-light)', fontWeight: isFullData ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', boxShadow: isFullData ? '0 2px 4px var(--shadow)' : 'none' }}
                onClick={() => setIsFullData(true)}
              >
                Entire File Data
              </button>
              <button 
                style={{ flex: 1, padding: '6px 12px', border: 'none', borderRadius: '4px', background: !isFullData ? 'var(--card-bg)' : 'transparent', color: !isFullData ? 'var(--ink)' : 'var(--ink-light)', fontWeight: !isFullData ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', boxShadow: !isFullData ? '0 2px 4px var(--shadow)' : 'none' }}
                onClick={() => setIsFullData(false)}
              >
                Everyone on Canvas
              </button>
            </div>
          </section>

        <section className="analytics-section">
          <h3>🌍 The Melting Pot</h3>
          {originsData.length > 0 ? (
            <DonutChart data={originsData} colors={originColors} />
          ) : (
            <p style={{ color: 'var(--ink-light)', fontStyle: 'italic', marginTop: '10px' }}>No historical immigrant data available in this view.</p>
          )}
        </section>


          <section className="analytics-section">
            <h3>👨‍👩‍👧‍👦 Family Size & Dynamics</h3>
            <ul className="stats-list">
              <li><strong>Largest Branch</strong> <span>{familyDynamics.largestFamily.parents} ({familyDynamics.largestFamily.count} children)</span></li>
              <li><strong>Average Family Size</strong> <span>{familyDynamics.averageSize} children</span></li>
              <li><strong>Generational Gap</strong> <span>{familyDynamics.averageGap} years (avg age of parents)</span></li>
            </ul>
          </section>
          <section className="analytics-section">
            <h3>📛 Most Common Names</h3>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--ink-light)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>First Names</h4>
                <ul className="stats-list">
                  {namesData.topFirst.map(([name, count], i) => (
                    <li key={i}><strong>{name}</strong> <span>{count}</span></li>
                  ))}
                </ul>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--ink-light)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Surnames</h4>
                <ul className="stats-list">
                  {namesData.topLast.map(([name, count], i) => (
                    <li key={i}><strong>{name}</strong> <span>{count}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="analytics-section">
            <h3>🔗 Namesakes & Lineage</h3>
            <ul className="stats-list">
              <li><strong>Direct Namesakes</strong> <span>{namesakesData.namesakesCount} relatives share a name with a parent</span></li>
            </ul>
            {namesakesData.topChains.length > 0 && (
              <div style={{ marginTop: '15px' }}>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--ink-light)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Longest Passed-Down Names</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {namesakesData.topChains.map((chain, i) => (
                    <div key={i} style={{ background: 'var(--badge-bg)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--badge-border)' }}>
                      <strong style={{ color: 'var(--accent)', fontSize: '1.05rem' }}>"{chain.name}"</strong> 
                      <span style={{ fontSize: '0.85rem', color: 'var(--ink-light)', marginLeft: '6px' }}>({chain.path.length} generations)</span>
                      <div style={{ marginTop: '4px', fontSize: '0.9rem', color: 'var(--ink)', lineHeight: '1.4' }}>
                        {chain.path.join(' → ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="analytics-section">
            <h3>🏆 Longest Lived Relatives</h3>
            <ul className="stats-list">
              {longevityData.map((p, i) => (
                <li key={i}>
                  <strong>
                    {p.name}
                    {p.isLiving && <span style={{ fontSize: '0.75rem', color: 'var(--accent2)', marginLeft: '6px', fontStyle: 'italic' }}>(Living)</span>}
                  </strong> 
                  <span>{p.age} years ({p.bYear} - {p.isLiving ? 'Present' : p.dYear})</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="analytics-section">
            <h3>🏥 Tree Health & Stats</h3>
            <ul className="stats-list">
              <li><strong>Total Profiles</strong> <span>{treeHealth.total} relatives</span></li>
              <li><strong>Average Lifespan</strong> <span>{treeHealth.avgLifespan} years</span></li>
              <li><strong>Profiles with Birth Dates</strong> <span>{treeHealth.withBirthPct}%</span></li>
              <li><strong>Profiles with Locations</strong> <span>{treeHealth.withPlacePct}%</span></li>
            </ul>
          </section>
          
        </div>
      </div>
    </div>
  );
}
