/**
 * Dual-pane interactive tree navigator: persons list on the left, focus view on the right.
 * Uses ActivePersonContext so the choice persists across routes.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  listAllPersons,
  findStartPerson,
  buildAncestorTree,
  buildDescendantTree,
  buildInteractiveFamilyGraph,
  findLargestDescendantRoot,
} from '../../lib/treeQuery.js';
import { buildFamilyTreeViewModel, buildPersonContext } from '../../lib/personContext.js';
import { eventTypeLabel } from '../../lib/catalogs.js';
import { deletePerson, deleteFamily } from '../../lib/subtree.js';
import { useActivePerson } from '../../contexts/ActivePersonContext.jsx';
import { PersonList } from './PersonList.jsx';
import { PersonFocus } from './PersonFocus.jsx';
import { ThreeDTreeView } from './ThreeDTreeView.jsx';
import { FlatInteractiveTreeView } from './FlatInteractiveTreeView.jsx';
import { SunTreeView } from './SunTreeView.jsx';
import { TraumatreeCanvasView } from './TraumatreeCanvasView.jsx';
import { FamilyTreeView } from './FamilyTreeView.jsx';
import { useIsMobile } from '../../lib/useIsMobile.js';
import { Gender, lifeSpanLabel } from '../../models/index.js';
import { resolveInitialTreePersonId } from './initialTreePerson.js';
import { persistTreeViewMode, readInitialTreeViewMode } from './treeViewMode.js';
import { BdiText, LtrText } from '../BdiText.jsx';
import { useModal } from '../../contexts/ModalContext.jsx';

export function InteractiveTreeApp() {
  const modal = useModal();
  const [persons, setPersons] = useState([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [context, setContext] = useState(null);
  const [trees, setTrees] = useState({ ancestor: null, descendant: null, graph: null, familyTree: null, loading: false });
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState(() => readInitialTreeViewMode(searchParams));
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [mobilePane, setMobilePane] = useState('focus');
  const [treeChrome, setTreeChrome] = useState({ navigation: false, people: false, inspector: false, header: false });
  // Persons expanded-in-place via their "further persons" pin (reset on re-root).
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const isMobile = useIsMobile();
  const { recordName: activeId, setActivePerson } = useActivePerson();
  const navigate = useNavigate();

  useEffect(() => {
    persistTreeViewMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    (async () => {
      const list = await listAllPersons();
      setPersons(list);
      if (list.length === 0) {
        setEmpty(true);
        setLoading(false);
        return;
      }
      const [startPerson, largestRoot] = await Promise.all([
        findStartPerson(),
        findLargestDescendantRoot(),
      ]);
      setActivePerson(resolveInitialTreePersonId({
        persons: list,
        activeId,
        startPerson,
        largestRoot,
      }));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      setTrees((current) => ({ ...current, loading: true }));
      const [ctx, ancestor, descendant, graph, familyTree] = await Promise.all([
        buildPersonContext(activeId),
        buildAncestorTree(activeId, 4),
        buildDescendantTree(activeId, viewMode === 'sun' ? 9 : 4),
        buildInteractiveFamilyGraph(activeId, {
          maxAncestorGenerations: 4,
          maxDescendantGenerations: 1,
          expandedIds: [...expandedIds],
        }),
        buildFamilyTreeViewModel(activeId),
      ]);
      if (!cancelled) {
        setContext(ctx);
        setTrees({ ancestor, descendant, graph, familyTree, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, viewMode, dataVersion, expandedIds]);

  useEffect(() => () => {
    window.dispatchEvent(new CustomEvent('cloudtreeweb:navigation-visibility', { detail: { hidden: false } }));
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cloudtreeweb:navigation-visibility', {
      detail: { hidden: viewMode === 'three' && !treeChrome.navigation },
    }));
  }, [treeChrome.navigation, viewMode]);

  const onPick = useCallback((recordName) => {
    setActivePerson(recordName);
    setMobilePane('focus');
    // A fresh root is a fresh context — drop any in-place expansions.
    setExpandedIds((current) => (current.size ? new Set() : current));
  }, [setActivePerson]);
  // Toggle a person's expand-in-place state (reveal/hide their further families).
  const onToggleExpand = useCallback((recordName) => {
    if (!recordName) return;
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(recordName)) next.delete(recordName);
      else next.add(recordName);
      return next;
    });
  }, []);
  const onDeletePerson = useCallback(async (recordName) => {
    if (!recordName) return;
    const target = persons.find((p) => p.recordName === recordName);
    const name = target?.fullName || 'this person';
    if (!(await modal.confirm(`Delete ${name}?\n\nThe person is removed and detached from their families. Their descendants are kept.`, {
      title: 'Delete person',
      okLabel: 'Delete',
      destructive: true,
    }))) {
      return;
    }
    await deletePerson(recordName);
    const list = await listAllPersons();
    setPersons(list);
    if (list.length === 0) {
      setEmpty(true);
      setActivePerson('');
      return;
    }
    // If we deleted the focused person (or the active one no longer exists),
    // re-root on a sensible survivor.
    if (recordName === activeId || !list.some((p) => p.recordName === activeId)) {
      const start = await findStartPerson().catch(() => null);
      const fallback = start?.recordName && list.some((p) => p.recordName === start.recordName)
        ? start.recordName
        : list[0].recordName;
      setActivePerson(fallback);
    }
    // Force the tree to rebuild even when a non-focused person was removed.
    setDataVersion((version) => version + 1);
  }, [persons, activeId, modal, setActivePerson]);
  const toggleTreeChrome = useCallback((key) => {
    setTreeChrome((current) => {
      const next = { ...current, [key]: !current[key] };
      if (key === 'navigation') {
        window.dispatchEvent(new CustomEvent('cloudtreeweb:navigation-visibility', { detail: { hidden: !next.navigation } }));
      }
      return next;
    });
  }, []);
  const returnToFamilyTreeChrome = useCallback(() => {
    const next = { navigation: true, people: true, inspector: true, header: true };
    setTreeChrome(next);
    window.dispatchEvent(new CustomEvent('cloudtreeweb:navigation-visibility', { detail: { hidden: false } }));
  }, []);
  const showTreeInfo = useCallback((recordName) => {
    setActivePerson(recordName);
    setMobilePane('focus');
    setTreeChrome((current) => ({ ...current, inspector: true }));
  }, [setActivePerson]);
  const openAncestor = useCallback(
    (recordName) => {
      setActivePerson(recordName);
      navigate('/charts?type=ancestor');
    },
    [navigate, setActivePerson]
  );
  const openDescendant = useCallback(
    (recordName) => {
      setActivePerson(recordName);
      navigate('/charts?type=descendant');
    },
    [navigate, setActivePerson]
  );
  const onAddRelative = useCallback(({ relation, anchorId, partnerId }) => {
    if (!anchorId) {
      // No anchor → empty-tree "Add First Person" or generic new flow.
      navigate('/person/new');
      return;
    }
    const isExisting = relation?.startsWith?.('existing');
    if (isExisting) {
      // Route to the appropriate FamilyEditor / PersonEditor for picking.
      const isChildRelation = relation === 'existingChild';
      const anchorFamily = isChildRelation
        ? (context?.families?.find((family) => !partnerId || family.partner?.recordName === partnerId)?.recordName || context?.families?.[0]?.recordName)
        : (relation === 'existingFather' || relation === 'existingMother' ? context?.parents?.[0]?.recordName : null);
      if (anchorFamily) {
        navigate(`/family/${encodeURIComponent(anchorFamily)}?addRelative=${encodeURIComponent(relation)}&intent=pickExisting`);
        return;
      }
      navigate(`/person/${encodeURIComponent(anchorId)}?addRelative=${encodeURIComponent(relation)}`);
      return;
    }
    // Create new person with prefilled relation.
    const params = new URLSearchParams({ relation, anchor: anchorId });
    if (partnerId) params.set('partner', partnerId);
    navigate(`/person/new?${params.toString()}`);
  }, [context, navigate]);
  const onDeleteFamily = useCallback(async (familyRecordName) => {
    if (!familyRecordName) return;
    if (!(await modal.confirm('Delete this family?\n\nThe relationship and its family events are removed. The people in it (parents and children) are kept.', {
      title: 'Delete family',
      okLabel: 'Delete',
      destructive: true,
    }))) {
      return;
    }
    await deleteFamily(familyRecordName);
    setDataVersion((version) => version + 1);
  }, [modal]);
  // Influential (associate) relations live in the Person editor; route there.
  const onEditInfluential = useCallback((recordName) => {
    if (recordName) navigate(`/person/${encodeURIComponent(recordName)}?section=influential`);
  }, [navigate]);
  const onOpenFamilySearch = useCallback((recordName) => {
    if (recordName) setActivePerson(recordName);
    navigate('/familysearch');
  }, [navigate, setActivePerson]);

  if (loading) return <EmptyMsg text="Loading…" />;
  if (empty) {
    return (
      <EmptyMsg>
        No family data found.{' '}
        <Link to="/" style={{ color: 'hsl(var(--primary))', marginLeft: 6 }}>Import a .mftpkg</Link> first.
      </EmptyMsg>
    );
  }

  const showList = !isMobile || mobilePane === 'list';
  const showFocus = !isMobile || mobilePane === 'focus';
  const showPeople = showList && (isMobile || viewMode !== 'three' || treeChrome.people);
  const showHeader = viewMode !== 'three' || treeChrome.header || isMobile;
  const showInspector = !isMobile && treeChrome.inspector;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {showPeople && (
        <div style={{ width: isMobile ? '100%' : 'min(280px, 46vw)', flexShrink: 0 }}>
          <PersonList persons={persons} activeId={activeId} onPick={onPick} />
        </div>
      )}
      {showFocus && (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {showHeader && (
          <div style={toolbar}>
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobilePane('list')}
                style={backBtn}
                aria-label="Back to person list"
              >
                ←
              </button>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={eyebrow}>Interactive Tree</div>
              <div style={title} title={context?.selfSummary?.fullName || ''}>
                <BdiText>{context?.selfSummary?.fullName || 'No person selected'}</BdiText>
              </div>
            </div>
            {/* Six tree view modes — the segmented control fits on desktop but
             * runs off the right edge on phones (3D Flat Sun Family Canvas
             * Details is ~360px even at minimum widths). On narrow screens
             * we collapse to a native select that takes one short line. */}
            {isMobile ? (
              <select
                value={viewMode}
                onChange={(event) => setViewMode(event.target.value)}
                aria-label="Tree view mode"
                style={viewModeSelect}
              >
                {TREE_VIEW_MODES.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            ) : (
              <div style={segmented} role="tablist" aria-label="Tree view mode">
                {TREE_VIEW_MODES.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setViewMode(id)}
                    style={segment(viewMode === id)}
                    aria-selected={viewMode === id}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          )}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {viewMode === 'three' ? (
              <div style={treeWorkspace}>
                <div style={treeCanvasPane}>
                  <ThreeDTreeView
                    ancestorTree={trees.ancestor}
                    descendantTree={trees.descendant}
                    familyGraph={trees.graph}
                    activeId={activeId}
                    loading={trees.loading}
                    onPick={onPick}
                    onEditPerson={(recordName) => navigate(`/person/${recordName}`)}
                    onOpenFamily={(recordName) => navigate(`/family/${recordName}`)}
                    onShowInfo={showTreeInfo}
                    onOpenAncestorChart={openAncestor}
                    onOpenDescendantChart={openDescendant}
                    onAddRelative={onAddRelative}
                    onDeletePerson={onDeletePerson}
                    onDeleteFamily={onDeleteFamily}
                    onEditInfluential={onEditInfluential}
                    onOpenFamilySearch={onOpenFamilySearch}
                    onToggleExpand={onToggleExpand}
                    expandedIds={expandedIds}
                    context={context}
                    chrome={treeChrome}
                    onToggleChrome={toggleTreeChrome}
                    onReturnToFamilyTree={returnToFamilyTreeChrome}
                  />
                </div>
                {showInspector && (
                  <TreeInspector
                    context={context}
                    onPick={onPick}
                    onEditPerson={(recordName) => navigate(`/person/${recordName}`)}
                    onOpenFamily={(recordName) => navigate(`/family/${recordName}`)}
                    onOpenAncestorChart={openAncestor}
                    onOpenDescendantChart={openDescendant}
                  />
                )}
              </div>
            ) : viewMode === 'flat' ? (
              <FlatInteractiveTreeView
                ancestorTree={trees.ancestor}
                descendantTree={trees.descendant}
                familyGraph={trees.graph}
                activeId={activeId}
                loading={trees.loading}
                onPick={onPick}
                onEditPerson={(recordName) => navigate(`/person/${recordName}`)}
                onShowInfo={showTreeInfo}
                onReturnToFamilyTree={returnToFamilyTreeChrome}
              />
            ) : viewMode === 'sun' ? (
              <SunTreeView
                descendantTree={trees.descendant}
                activeId={activeId}
                loading={trees.loading}
                onPick={onPick}
                onEditPerson={(recordName) => navigate(`/person/${recordName}`)}
              />
            ) : viewMode === 'family' ? (
              <FamilyTreeView
                model={trees.familyTree}
                activeId={activeId}
                loading={trees.loading}
                onPick={onPick}
                onEditPerson={(recordName) => navigate(`/person/${recordName}`)}
                onOpenFamily={(recordName) => navigate(`/family/${recordName}`)}
              />
            ) : viewMode === 'canvas' ? (
              <TraumatreeCanvasView
                graph={trees.graph}
                activeId={activeId}
                loading={trees.loading}
                onPick={onPick}
                onEditPerson={(recordName) => navigate(`/person/${recordName}`)}
                onOpenFamily={(recordName) => navigate(`/family/${recordName}`)}
              />
            ) : (
              <PersonFocus
                context={context}
                onPick={onPick}
                onOpenAncestorChart={openAncestor}
                onOpenDescendantChart={openDescendant}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TreeInspector({
  context,
  onPick,
  onEditPerson,
  onOpenFamily,
  onOpenAncestorChart,
  onOpenDescendantChart,
}) {
  if (!context?.selfSummary) {
    return <aside style={inspector} />;
  }
  const self = context.selfSummary;
  const parents = context.parents.flatMap((fam) => [fam.man, fam.woman]).filter(Boolean);
  const partners = context.families.map((fam) => fam.partner).filter(Boolean);
  const children = context.families.flatMap((fam) => fam.children).filter(Boolean);

  return (
    <aside style={inspector}>
      <div style={inspectorHero}>
        <div style={avatar(self.gender)} aria-hidden="true">{initials(self.fullName)}</div>
        <div style={{ minWidth: 0 }}>
          <div style={inspectorName} title={self.fullName}><BdiText>{self.fullName}</BdiText></div>
          <div style={inspectorSub}><LtrText>{lifeSpanLabel(self) || 'No life dates'}</LtrText></div>
        </div>
      </div>

      <InspectorSection title="Actions">
        <div style={actionGrid}>
          <button type="button" style={tileButton} onClick={() => onEditPerson(self.recordName)}>Edit Person</button>
          <button type="button" style={tileButton} onClick={() => onOpenAncestorChart(self.recordName)}>Ancestors</button>
          <button type="button" style={tileButton} onClick={() => onOpenDescendantChart(self.recordName)}>Descendants</button>
          {context.families[0]?.family?.recordName ? (
            <button type="button" style={tileButton} onClick={() => onOpenFamily(context.families[0].family.recordName)}>Select Family</button>
          ) : (
            <button type="button" style={{ ...tileButton, opacity: 0.55 }} disabled>Select Family</button>
          )}
        </div>
      </InspectorSection>

      <InspectorSection title="Family">
        <RelationGroup title="Parents" people={parents} onPick={onPick} />
        <RelationGroup title="Partners" people={partners} onPick={onPick} />
        <RelationGroup title="Children" people={children} onPick={onPick} />
      </InspectorSection>

      <InspectorSection title={`Events (${context.events.length})`}>
        <div style={eventList}>
          {context.events.slice(0, 4).map((event) => (
            <div key={event.recordName} style={eventRow}>
              <div style={eventDot} />
              <div style={{ minWidth: 0 }}>
                <div style={eventTitle}>{eventLabel(event)}</div>
                <div style={eventMeta}>{event.fields?.date?.value || 'No date entered'}</div>
              </div>
            </div>
          ))}
          {context.events.length === 0 && <div style={emptySmall}>No events recorded.</div>}
        </div>
      </InspectorSection>
    </aside>
  );
}

function eventLabel(event) {
  const description = event.fields?.description?.value;
  if (description) return description;
  return eventTypeLabel(event.fields?.conclusionType?.value || event.fields?.eventType?.value);
}

function InspectorSection({ title, children }) {
  return (
    <section style={inspectorSection}>
      <div style={inspectorSectionTitle}>{title}</div>
      {children}
    </section>
  );
}

function RelationGroup({ title, people, onPick }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={relationTitle}>{title}</div>
      {people.length === 0 ? (
        <div style={emptySmall}>None recorded.</div>
      ) : (
        <div style={relationList}>
          {people.slice(0, 5).map((person) => (
            <button key={person.recordName} type="button" style={relationButton} onClick={() => onPick(person.recordName)}>
              <span style={relationName}><BdiText>{person.fullName}</BdiText></span>
              <span style={relationLife}><LtrText>{lifeSpanLabel(person)}</LtrText></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}

function avatar(gender) {
  const fill =
    gender === Gender.Male
      ? 'linear-gradient(145deg, #9dcfff, #4f90e8)'
      : gender === Gender.Female
        ? 'linear-gradient(145deg, #ffc0d2, #e46c91)'
        : 'linear-gradient(145deg, #f2e4bd, #b9a36d)';
  return {
    width: 54,
    height: 54,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    background: fill,
    color: '#fff',
    font: '800 17px -apple-system, system-ui, sans-serif',
    boxShadow: 'inset 0 0 0 2px rgb(255 255 255 / 0.58), 0 8px 18px rgb(0 0 0 / 0.12)',
  };
}

const backBtn = {
  background: 'transparent',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  color: 'hsl(var(--foreground))',
  font: '600 16px -apple-system, system-ui, sans-serif',
  cursor: 'pointer',
  width: 40,
  height: 40,
  flexShrink: 0,
};

function EmptyMsg({ text, children }) {
  return (
    <div style={empty}>
      {text}
      {children}
    </div>
  );
}

const empty = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'hsl(var(--muted-foreground))',
  fontSize: 14,
};

const toolbar = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  padding: '10px 16px',
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  flexWrap: 'wrap',
  minHeight: 64,
};
const treeWorkspace = {
  height: '100%',
  display: 'flex',
  minHeight: 0,
  overflow: 'hidden',
};
const treeCanvasPane = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
};
const inspector = {
  width: 318,
  flexShrink: 0,
  overflow: 'auto',
  borderInlineStart: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  padding: 14,
};
const inspectorHero = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 4px 14px',
};
const inspectorName = {
  color: 'hsl(var(--foreground))',
  fontSize: 16,
  fontWeight: 760,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const inspectorSub = {
  color: 'hsl(var(--muted-foreground))',
  fontSize: 12,
  marginTop: 3,
};
const inspectorSection = {
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  background: 'hsl(var(--background))',
  padding: 10,
  marginBottom: 12,
};
const inspectorSectionTitle = {
  color: 'hsl(var(--foreground))',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 10,
};
const actionGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
};
const tileButton = {
  minHeight: 58,
  borderRadius: 7,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  font: '750 12px -apple-system, system-ui, sans-serif',
  cursor: 'pointer',
};
const relationTitle = {
  color: 'hsl(var(--muted-foreground))',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0,
  marginBottom: 6,
};
const relationList = {
  display: 'grid',
  gap: 6,
};
const relationButton = {
  width: '100%',
  textAlign: 'start',
  border: '1px solid hsl(var(--border))',
  borderRadius: 7,
  background: 'hsl(var(--card))',
  padding: '8px 10px',
  cursor: 'pointer',
};
const relationName = {
  display: 'block',
  color: 'hsl(var(--foreground))',
  fontSize: 12,
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const relationLife = {
  display: 'block',
  color: 'hsl(var(--muted-foreground))',
  fontSize: 11,
  marginTop: 2,
};
const eventList = {
  display: 'grid',
  gap: 8,
};
const eventRow = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
};
const eventDot = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'hsl(var(--primary))',
  marginTop: 4,
  flexShrink: 0,
};
const eventTitle = {
  color: 'hsl(var(--foreground))',
  fontSize: 12,
  fontWeight: 700,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const eventMeta = {
  color: 'hsl(var(--muted-foreground))',
  fontSize: 11,
  marginTop: 2,
};
const emptySmall = {
  color: 'hsl(var(--muted-foreground))',
  fontSize: 12,
};
const eyebrow = {
  color: 'hsl(var(--muted-foreground))',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0,
  marginBottom: 3,
};
const title = {
  color: 'hsl(var(--foreground))',
  fontSize: 17,
  fontWeight: 750,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
// Ordered list of tree-view modes — kept here so both the desktop segmented
// control and the mobile <select> render the same options in the same order.
const TREE_VIEW_MODES = [
  ['three', '3D'],
  ['flat', 'Flat'],
  ['sun', 'Sun'],
  ['family', 'Family'],
  ['canvas', 'Canvas'],
  ['details', 'Details'],
];
const viewModeSelect = {
  height: 36,
  borderRadius: 8,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  padding: '0 10px',
  font: '600 13px -apple-system, system-ui, sans-serif',
  cursor: 'pointer',
  flexShrink: 0,
};
const segmented = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: 4,
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  background: 'hsl(var(--secondary))',
  overflowX: 'auto',
  maxWidth: '100%',
  flexShrink: 0,
};
function segment(active) {
  return {
    border: '1px solid transparent',
    borderRadius: 6,
    background: active ? 'hsl(var(--background))' : 'transparent',
    color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
    boxShadow: active ? '0 1px 6px rgb(0 0 0 / 0.08)' : 'none',
    padding: '6px 10px',
    minWidth: 56,
    font: '700 12px -apple-system, system-ui, sans-serif',
    cursor: 'pointer',
    flexShrink: 0,
  };
}

export default InteractiveTreeApp;
