/**
 * One-shot bootstrap for the charts page. Loads the person summaries (with and
 * without private records, to derive the private-record id set), the saved
 * chart documents/templates, and the research-completeness rows; applies a
 * chart document requested via URL (?imported/?document/?template); and
 * resolves the initial root person. Owns the `loading`/`empty` page states.
 *
 * The effect body is moved verbatim from ChartsApp and still runs exactly once
 * on mount.
 */
import { useEffect, useState } from 'react';
import { listAllPersons, findStartPerson } from '../../../lib/treeQuery.js';
import { listChartTemplates } from '../../../lib/chartTemplates.js';
import { listChartDocuments } from '../../../lib/chartDocuments.js';
import { loadSavedChartDocument } from '../../../lib/chartContainerLoader.js';
import { normalizeChartDocument } from '../../../lib/chartDocumentSchema.js';
import { loadCompletenessRowsByPerson } from '../../../lib/researchCompleteness.js';

export function useChartsBootstrap({
  searchParams,
  rootId,
  setRootId,
  setActivePerson,
  setCompletenessRowsByPerson,
  setTemplates,
  setDocuments,
  applyDocumentState,
}) {
  const [persons, setPersons] = useState([]);
  // Record names flagged private (`isPrivate`). The chart data source filters
  // these out when "Hide Information marked as Private" is on. Derived by
  // diffing the private-inclusive person list against the public-only one,
  // since person summaries don't carry a privacy flag of their own.
  const [privateIds, setPrivateIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    (async () => {
    const [list, publicList] = await Promise.all([
        listAllPersons({ includePrivate: true }),
        listAllPersons(),
      ]);
      const docs = await listChartDocuments();
      const tpls = await listChartTemplates();
      const completenessRows = await loadCompletenessRowsByPerson();
      const publicIds = new Set(publicList.map((person) => person.recordName));
      setPrivateIds(new Set(
        list.filter((person) => !publicIds.has(person.recordName)).map((person) => person.recordName)
      ));
      setPersons(list);
      setCompletenessRowsByPerson(completenessRows);
      setTemplates(tpls);
      setDocuments(docs);
      const importedRecord = searchParams.get('imported');
      const requestedDocId = searchParams.get('document');
      const requestedTemplateId = searchParams.get('template');
      let requestedDoc = null;

      if (importedRecord) {
        try {
          requestedDoc = await loadSavedChartDocument(importedRecord);
        } catch (_error) {
          requestedDoc = null;
        }
      } else if (requestedDocId) {
        requestedDoc = docs.find((doc) => doc.id === requestedDocId);
      } else if (requestedTemplateId) {
        requestedDoc = tpls.find((tpl) => tpl.id === requestedTemplateId);
      }

      if (requestedDoc) {
        applyDocumentState(requestedDoc, { fromImport: Boolean(importedRecord) });
      }
      if (list.length === 0) {
        setEmpty(true);
        setLoading(false);
        return;
      }
      const requestedRootId = requestedDoc ? normalizeChartDocument(requestedDoc).roots.primaryPersonId : searchParams.get('person');
      const desiredRootId = requestedRootId || rootId;
      if (!desiredRootId || !list.some((p) => p.recordName === desiredRootId)) {
        const start = await findStartPerson();
        const pick = start?.recordName || list[0].recordName;
        setRootId(pick);
        setActivePerson(pick);
      } else if (requestedRootId) {
        setActivePerson(requestedRootId);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { persons, privateIds, loading, empty };
}
