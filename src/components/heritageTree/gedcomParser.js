import calcTree from 'relatives-tree';

export const CW = 192, PX = 80, PY = 80;

export function parseGedcom(data, preferredRootId = null) {
  const lines = data.split(/\r?\n/);
  const indis = {};
  const fams = {};
  let current = null;
  let parsingTag = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const matchIndi = line.match(/^0 (@[A-Z0-9_]+@) INDI/);
    const matchFam = line.match(/^0 (@[A-Z0-9_]+@) FAM/);

    if (matchIndi) {
      current = { id: matchIndi[1], type: 'INDI', name: '', given: '', surname: '', birth: '', death: '', place: '', deathPlace: '', famc: [], fams: [] };
      indis[current.id] = current;
      parsingTag = null;
    } else if (matchFam) {
      current = { id: matchFam[1], type: 'FAM', husb: null, wife: null, chil: [] };
      fams[current.id] = current;
      parsingTag = null;
    } else if (line.startsWith('0 ')) {
      current = null;
    } else if (current) {
      const parts = line.trim().split(' ');
      const lvl = parts[0], tag = parts[1], val = parts.slice(2).join(' ').trim();

      if (current.type === 'INDI') {
        if (lvl === '1') {
          parsingTag = tag;
          if (tag === 'NAME') {
            current.name = val.replace(/\//g, '').trim();
            const surMatch = val.match(/\/(.*?)\//);
            current.surname = surMatch ? surMatch[1].trim() : '';
            current.given = val.replace(/\/(.*?)\//g, '').replace(/[()"]/g, '').trim();
          }
          if (tag === 'SEX') current.sex = val;
          if (tag === 'FAMC') current.famc.push(val);
          if (tag === 'FAMS') current.fams.push(val);
        } else if (lvl === '2') {
          if (tag === 'DATE') {
            if (parsingTag === 'BIRT') current.birth = val;
            if (parsingTag === 'DEAT') current.death = val;
          } else if (tag === 'PLAC') {
            if (parsingTag === 'BIRT') current.place = val;
            if (parsingTag === 'DEAT') current.deathPlace = val;
          }
        }
      } else if (current.type === 'FAM') {
        if (lvl === '1') {
          if (tag === 'HUSB') current.husb = val;
          else if (tag === 'WIFE') current.wife = val;
          else if (tag === 'CHIL') current.chil.push(val);
        }
      }
    }
  }

  if (Object.keys(indis).length === 0) {
    return { nodes: [], connectors: [], maxGen: 0, individuals: [], rootId: null, genBands: [], genLabels: [], indis: {}, fams: {} };
  }

  // --- GLOBAL DATA CLEANUP ---
  Object.keys(fams).forEach(fId => {
    const fam = fams[fId];
    // 1. Strict Bidirectionality
    if (fam.husb && (!indis[fam.husb] || !indis[fam.husb].fams.includes(fId))) fam.husb = null;
    if (fam.wife && (!indis[fam.wife] || !indis[fam.wife].fams.includes(fId))) fam.wife = null;
    // 2. Same-Sex Artifact Filter
    if (fam.husb && fam.wife) {
      const hSex = indis[fam.husb].sex ? indis[fam.husb].sex.toUpperCase() : '';
      const wSex = indis[fam.wife].sex ? indis[fam.wife].sex.toUpperCase() : '';
      if (hSex && wSex && hSex === wSex) { fam.husb = null; fam.wife = null; fam.chil = []; }
    }
    // 3. Clean up children bidirectionality
    fam.chil = fam.chil.filter(cId => indis[cId] && indis[cId].famc.includes(fId));
  });
  
  // Enforce strict single-family child limits (Prevent multi-parent DAG crashes)
  Object.values(indis).forEach(indi => {
    const validFamc = indi.famc.filter(fId => fams[fId] && fams[fId].chil.includes(indi.id));
    if (validFamc.length > 0) {
      validFamc.sort((a, b) => ((fams[b].husb?1:0)+(fams[b].wife?1:0)) - ((fams[a].husb?1:0)+(fams[a].wife?1:0)));
      indi.famc = [validFamc[0]]; // Keep only the primary family
      validFamc.slice(1).forEach(fId => fams[fId].chil = fams[fId].chil.filter(cId => cId !== indi.id));
    } else indi.famc = [];
  });

  // --- FIX FOR RELATIVES-TREE EMPTY ARRAY CRASH ---
  let dummyIndex = 1;
  Object.values(fams).forEach(fam => {
    if ((fam.husb || fam.wife) && fam.chil.length === 0) {
      const dummyId = `DUMMY_${dummyIndex++}`;
      indis[dummyId] = { id: dummyId, type: 'INDI', name: '', sex: 'U', famc: [fam.id], fams: [], isDummy: true };
      fam.chil.push(dummyId);
    }
  });
  // ---------------------------

  // --- ORIGIN CALCULATION ---
  Object.values(indis).forEach(i => {
    if (i.isDummy) return;
    let o = '';
    const plStr = i.place || i.deathPlace || '';
    const pl = plStr.toLowerCase();
    if (pl) {
      if (pl.includes('rusyn') || pl.includes('ruthenia') || pl.includes('csircs') || pl.includes('carpatho')) o = 'rusyn';
      else if (pl.includes('poland') || pl.includes('malopolskie')) o = 'polish';
      else if (pl.includes('czech')) o = 'czech';
      else if (pl.includes('slovakia')) o = 'slovak';
      else if (pl.includes('austria')) o = 'austrian';
      else if (pl.includes('lebanon')) o = 'lebanese';
      else if (pl.includes('germany') || pl.includes('deutschland') || pl.includes('bayern') || pl.includes('baden')) o = 'german';
      else if (pl.includes('france') || pl.includes('alsace') || pl.includes('bas-rhin') || pl.includes('moselle')) o = 'french';
      else if (pl.includes('switzerland') || pl.includes('zürich') || pl.includes('zurich')) o = 'swiss';
      else if (pl.includes('irish') || pl.includes('ireland')) o = 'irish';
      else if (pl.includes('usa') || pl.match(/\busa?\b/) || pl.includes('united states') || pl.includes('america') || pl.includes('pennsylvania') || pl.match(/\bpa\b/) || pl.includes('virginia') || pl.match(/\bwv\b/) || pl.includes('carolina') || pl.includes('california') || pl.includes('new york') || pl.includes('ohio') || pl.includes('texas')) o = 'american';
      else if (pl.includes('england') || pl.match(/\buk\b/) || pl.includes('united kingdom') || pl.includes('britain') || pl.includes('london')) o = 'english';
      else if (pl.includes('scotland') || pl.includes('scottish')) o = 'scottish';
      else if (pl.includes('italy') || pl.includes('italia') || pl.includes('sicily')) o = 'italian';
      else if (pl.includes('spain') || pl.includes('españa') || pl.includes('madrid')) o = 'spanish';
      else if (pl.includes('canada') || pl.includes('ontario') || pl.includes('quebec') || pl.includes('nova scotia')) o = 'canadian';
      else if (pl.includes('mexico') || pl.includes('méxico')) o = 'mexican';
      else if (pl.includes('ukraine') || pl.includes('ukrainian') || pl.includes('kiev') || pl.includes('kyiv')) o = 'ukrainian';
      else if (pl.includes('russia') || pl.includes('ussr') || pl.includes('soviet') || pl.includes('moscow')) o = 'russian';
      else if (pl.includes('china') || pl.includes('chinese') || pl.includes('beijing')) o = 'chinese';
      else if (pl.includes('syria') || pl.includes('syrian') || pl.includes('damascus')) o = 'syrian';
      else if (pl.includes('hungary') || pl.includes('hungarian') || pl.includes('budapest')) o = 'hungarian';
      else if (pl.includes('turkey') || pl.includes('turkiye') || pl.includes('turkish') || pl.includes('istanbul')) o = 'turkish';
      else o = 'generic'; 
    }
    i.origin = o;
  });

  // --- HERITAGE CALCULATION ---
  const getHeritage = (id, depth = 0) => {
    if (depth > 50) return { untraced: 100 }; // Safety against loops
    const person = indis[id];
    if (!person) return { untraced: 100 };
    if (person.heritage) return person.heritage; // Memoized return

    let org = person.origin || 'untraced';
    // Flag "New World" end-of-line ancestors as untraced so they don't mathematically dilute immigrant roots
    if (org === 'american' || org === 'canadian' || org === 'generic') org = 'untraced';

    if (person.famc.length === 0) {
      // Founder: 100% of their own birthplace
      const h = {};
      h[org] = 100;
      person.heritage = h;
      return h;
    }

    const fam = fams[person.famc[0]];
    const dadH = fam && fam.husb ? getHeritage(fam.husb, depth + 1) : { untraced: 100 };
    const momH = fam && fam.wife ? getHeritage(fam.wife, depth + 1) : { untraced: 100 };

    const combined = {};
    for (const [o, pct] of Object.entries(dadH)) combined[o] = (combined[o] || 0) + (pct / 2);
    for (const [o, pct] of Object.entries(momH)) combined[o] = (combined[o] || 0) + (pct / 2);

    // --- SMART FOUNDER FALLBACK & BORDER SHIFT FIX ---
    // If the parents' heritage is completely untraced, OR this person has a known immigrant origin
    // that is completely missing from their parents' heritage (due to historical border shifts 
    // like Austria -> Ukraine), we blend their own geographic origin in!
    if (org !== 'untraced' && !combined[org]) {
      if (combined.untraced === 100) {
        const h = {};
        h[org] = 100;
        person.heritage = h;
        return h;
      } else {
        // Blend their own distinct origin in to preserve the historical border shift/migration
        const blended = {};
        let total = 0;
        for (const [o, pct] of Object.entries(combined)) {
          if (o !== 'untraced') {
            blended[o] = pct / 2;
            total += pct / 2;
          }
        }
        blended[org] = 100 - total; // Fill the remaining heritage with their distinct origin
        person.heritage = blended;
        return blended;
      }
    }

    person.heritage = combined;
    return combined;
  };

  Object.keys(indis).forEach(id => getHeritage(id));

  // --- RELATIVES-TREE LAYOUT ALGORITHM ---
  const dedup = (arr) => {
    const seen = new Set();
    return arr.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  };

  const rtNodes = Object.values(indis).map(i => {
    const parents = [];
    const children = [];
    const spouses = [];
    const siblings = [];

    if (i.famc.length > 0) {
      const fam = fams[i.famc[0]];
      if (fam) {
        if (fam.husb) parents.push({ id: fam.husb, type: 'blood' });
        if (fam.wife) parents.push({ id: fam.wife, type: 'blood' });
        fam.chil.forEach(cId => {
          if (cId !== i.id) siblings.push({ id: cId, type: 'blood' });
        });
      }
    }

    i.fams.forEach(fId => {
      const fam = fams[fId];
      // Security Check: Enforce strict bidirectionality against Ancestry artifacts
      if (fam && (fam.husb === i.id || fam.wife === i.id)) {
        const spouseId = fam.husb === i.id ? fam.wife : fam.husb;
        if (spouseId) spouses.push({ id: spouseId, type: 'married' });
        fam.chil.forEach(cId => {
          children.push({ id: cId, type: 'blood' });
        });
      }
    });

    let gender = 'male'; // Safe default
    const sexStr = i.sex ? i.sex.toUpperCase() : '';
    if (sexStr.startsWith('F')) gender = 'female';
    else if (sexStr.startsWith('M')) gender = 'male';
    else {
      if (i.fams.some(fId => fams[fId]?.wife === i.id)) gender = 'female';
    }

    return { id: i.id, gender, parents: dedup(parents), children: dedup(children), siblings: dedup(siblings), spouses: dedup(spouses) };
  });

  // Prepare sorted list of all people for the dropdown
  const individuals = Object.values(indis).filter(i => !i.isDummy).map(i => {
    let label = i.name || 'Unknown';
    const bYear = i.birth ? (i.birth.match(/\d{4}/) || [''])[0] : '';
    const dYear = i.death ? (i.death.match(/\d{4}/) || [''])[0] : '';
    if (bYear || dYear) label += ` (${bYear} - ${dYear})`;
    
    // Add a hint for phantom/duplicate records
    const connCount = i.famc.length + i.fams.length;
    if (connCount === 0) label += ' [Disconnected]';

    return { id: i.id, name: label, sortName: i.name || 'Unknown', connCount };
  }).sort((a, b) => {
    const nameCmp = a.sortName.localeCompare(b.sortName);
    if (nameCmp !== 0) return nameCmp;
    return b.connCount - a.connCount; // Put the fully connected duplicate first
  });

  const defaultRoot = Object.values(indis)
    .filter(i => !i.isDummy)
    .sort((a, b) => ((b.famc?.length || 0) + (b.fams?.length || 0)) - ((a.famc?.length || 0) + (a.fams?.length || 0)))[0];
  const validRootId = preferredRootId && indis[preferredRootId] && !indis[preferredRootId].isDummy ? preferredRootId : defaultRoot?.id;
  let tree;
  try {
    tree = calcTree(rtNodes, { rootId: validRootId });
  } catch (err) {
    // Fallback: If layout engine crashes (like on a childless root spouse), pivot to try their spouse instead
    let fallbackSuccess = false;
    const rootPerson = indis[validRootId];
    if (rootPerson) {
      for (const fId of rootPerson.fams) {
        const fam = fams[fId];
        if (!fam) continue;
        const spouseId = fam.husb === validRootId ? fam.wife : fam.husb;
        if (spouseId) {
          try { tree = calcTree(rtNodes, { rootId: spouseId }); fallbackSuccess = true; break; } catch(e) {}
        }
      }
      if (!fallbackSuccess) {
        for (const fId of rootPerson.famc) {
          const fam = fams[fId];
          if (!fam) continue;
          if (fam.husb) { try { tree = calcTree(rtNodes, { rootId: fam.husb }); fallbackSuccess = true; break; } catch(e) {} }
          if (!fallbackSuccess && fam.wife) { try { tree = calcTree(rtNodes, { rootId: fam.wife }); fallbackSuccess = true; break; } catch(e) {} }
        }
      }
    }
    if (!fallbackSuccess) {
      return { nodes: [], connectors: [], maxGen: 0, individuals, rootId: validRootId, genBands: [], genLabels: [], indis, fams };
    }
  }

  // Calculate the layout grid using ONLY the real, visible cards
  const realNodes = tree.nodes.filter(n => indis[n.id] && !indis[n.id].isDummy);
  if (realNodes.length === 0) {
    return { nodes: [], connectors: [], maxGen: 0, individuals, rootId: validRootId, genBands: [], genLabels: [], indis, fams };
  }

  const minTop = Math.min(...realNodes.map(n => n.top));
  const minLeft = Math.min(...realNodes.map(n => n.left));
  let rtMaxGen = 1;

  const X_UNIT = 130; // Horizontal grid spacing multiplier
  const Y_UNIT = 160; // Vertical grid spacing multiplier
  
  const mapX = (val) => (val - minLeft) * X_UNIT + PX;
  const mapY = (val) => (val - minTop) * Y_UNIT + PY;

  const renderedIds = new Set(realNodes.map(n => n.id));

  // Map Relatives-Tree coordinates to our nodes
  const nodes = realNodes.map(rtn => {
    const i = indis[rtn.id];
    if (!i) return null; // Skip dummy routing nodes generated by relatives-tree

    const gen = Math.floor((rtn.top - minTop) / 2) + 1;
    if (gen > rtMaxGen) rtMaxGen = gen;
    
    // relatives-tree nodes default to 2x2. Their center point is left + 1, top + 1.
    // We calculate the center pixel, then subtract half the card size to align it.
    const centerX = mapX(rtn.left + 1);
    const centerY = mapY(rtn.top + 1);

    // Check if the person has parents, children, or spouses in the GEDCOM that aren't on the canvas
    let hasHiddenRelations = false;

    if (i.famc.length > 0) {
      const fam = fams[i.famc[0]];
      if (fam) {
        if (fam.husb && indis[fam.husb] && !indis[fam.husb].isDummy && !renderedIds.has(fam.husb)) hasHiddenRelations = true;
        if (fam.wife && indis[fam.wife] && !indis[fam.wife].isDummy && !renderedIds.has(fam.wife)) hasHiddenRelations = true;
      }
    }

    i.fams.forEach(fId => {
      const fam = fams[fId];
      if (fam) {
        const spouseId = fam.husb === i.id ? fam.wife : fam.husb;
        if (spouseId && indis[spouseId] && !indis[spouseId].isDummy && !renderedIds.has(spouseId)) hasHiddenRelations = true;
        fam.chil.forEach(cId => {
          if (indis[cId] && !indis[cId].isDummy && !renderedIds.has(cId)) hasHiddenRelations = true;
        });
      }
    });

    return { ...i, x: centerX - CW / 2, y: centerY - 45, h: 90, gen, hasHiddenRelations };
  }).filter(Boolean);

  const dummyPoints = tree.nodes.filter(n => indis[n.id]?.isDummy).map(n => ({
    x: mapX(n.left + 1),
    y: mapY(n.top)
  }));

  // Map Relatives-Tree orthogonal connectors
  const connectors = [];
  tree.connectors.forEach((c, idx) => {
    const rawPoints = Array.isArray(c) ? c : c.points;
    // Prune off phantom lines that reach up into invisible cropped generations
    if (!rawPoints || rawPoints.some((val, i) => i % 2 !== 0 && val < minTop)) return;
    
    const pts = [];

    for (let i = 0; i < rawPoints.length; i += 2) {
      pts.push({ x: mapX(rawPoints[i]), y: mapY(rawPoints[i+1]) });
    }
    
    // Only flag as a marriage line if it perfectly spans horizontally between two spouses
    let isMarriage = false;
    if (pts.length > 1 && pts.every(p => p.y === pts[0].y)) {
      const lineY = pts[0].y;
      const minX = Math.min(...pts.map(p => p.x));
      const maxX = Math.max(...pts.map(p => p.x));

      const leftNode = nodes.find(n => Math.abs((n.x + CW / 2) - minX) < 10 && Math.abs((n.y + 45) - lineY) < 10);
      const rightNode = nodes.find(n => Math.abs((n.x + CW / 2) - maxX) < 10 && Math.abs((n.y + 45) - lineY) < 10);

      if (leftNode && rightNode) {
        isMarriage = leftNode.fams.some(fId => rightNode.fams.includes(fId));
      }
    }

    // Prune lines dropping down to invisible dummy nodes
    const isDummyLine = pts.some(p => dummyPoints.some(dp => Math.abs(p.x - dp.x) < 1 && Math.abs(p.y - dp.y) < 1));
    if (!isDummyLine) {
      connectors.push({
        id: idx,
        path: pts.map(p => `${p.x},${p.y}`).join(' '),
        isMarriage
      });
    }
  });

  // Calculate generation bands and labels exactly between our Y coordinates
  const genBands = [];
  const genLabels = [];
  for (let i = 0; i < rtMaxGen; i++) {
    genLabels.push({ gen: i + 1, y: mapY(minTop + i * 2 + 1) - 45 });
    if (i < rtMaxGen - 1) {
      genBands.push({ id: i, y: mapY(minTop + (i + 1) * 2) });
    }
  }

  return { nodes, connectors, maxGen: rtMaxGen, individuals, rootId: validRootId, genBands, genLabels, indis, fams };
}
