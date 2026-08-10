import assert from 'node:assert/strict';
import test from 'node:test';

import {
  approveDisposition,
  computeRevisionDigest,
  evaluateClosure,
  openRecallCase,
  resolveUncertainty,
} from '../../src/core/recall.ts';
import { createIntegrityReceipt, createReceiptPayload } from '../../src/core/receipt.ts';
import { findImpactedAssets } from '../../src/core/graph.ts';
import type { Disposition, RecallCase, TriggerType } from '../../src/core/types.ts';

const event = {
  id: 'event-license-1',
  trigger: 'LICENSE_REVOKED' as const,
  sourceUrn: 'urn:dataset:source',
  evidence: { notice: 'revocation-42' },
  actor: 'commander@example.com',
  occurredAt: '2026-08-09T10:00:00.000Z',
};

function createCase(options: { uncertain?: boolean; missingOwner?: boolean; writeback?: boolean } = {}) {
  return openRecallCase({
    id: 'case-license-1',
    event,
    mode: 'fixture',
    evidenceIdentity: 'fixture:license-revoked:v1',
    graph: {
      nodes: [
        { id: event.sourceUrn, type: 'dataset', owner: 'data@example.com' },
        {
          id: 'urn:model:fraud',
          type: 'model',
          ...(options.missingOwner ? {} : { owner: 'ml@example.com' }),
          ...(options.uncertain
            ? { uncertainty: { id: 'uncertainty:model-fraud', description: 'source linkage pending' } }
            : {}),
        },
        { id: 'urn:deployment:fraud-api', type: 'deployment', owner: 'ops@example.com' },
      ],
      edges: [
        { from: event.sourceUrn, to: 'urn:model:fraud' },
        { from: 'urn:model:fraud', to: 'urn:deployment:fraud-api' },
      ],
    },
    writebackRefs: options.writeback
      ? { required: ['datahub:warning', 'datahub:closure'], successful: ['datahub:warning', 'datahub:closure'] }
      : { required: ['datahub:closure'], successful: [] },
  });
}

function openInput() {
  return {
    id: 'case-boundary', event, mode: 'fixture' as const, evidenceIdentity: 'fixture:boundary:v1',
    graph: {
      nodes: [
        { id: event.sourceUrn, type: 'dataset' as const, owner: 'data@example.com' },
        { id: 'urn:model:boundary', type: 'model' as const, owner: 'ml@example.com' },
      ],
      edges: [{ from: event.sourceUrn, to: 'urn:model:boundary' }],
    },
    writebackRefs: { required: ['closure'], successful: [] },
  };
}

function approvalFor(caseState: RecallCase, assetId: string) {
  return {
    assetId, disposition: 'retrain' as const, approver: 'human@example.com',
    approvedAt: '2026-08-09T11:00:00.000Z', revisionDigest: caseState.revisionDigest,
  };
}

function resolutionFor() {
  return {
    uncertaintyId: 'uncertainty:model-fraud', resolvedBy: 'human@example.com',
    resolvedAt: '2026-08-09T11:00:00.000Z', note: 'confirmed lineage',
  };
}

function approve(caseState: ReturnType<typeof createCase>, assetId: string) {
  return approveDisposition(caseState, {
    assetId,
    disposition: 'retrain',
    approver: 'human@example.com',
    approvedAt: '2026-08-09T11:00:00.000Z',
    revisionDigest: caseState.revisionDigest,
  });
}

test('opens every trigger with an unresolved decision per impacted asset', () => {
  const caseState = createCase();
  assert.equal(caseState.decisions.length, 2);
  assert.deepEqual(evaluateClosure(caseState), {
    closable: false,
    blockers: ['missing approved disposition: urn:deployment:fraud-api', 'missing approved disposition: urn:model:fraud', 'missing successful writeback: datahub:closure'],
  });
  const triggers: readonly TriggerType[] = ['LICENSE_REVOKED', 'ERASURE_REQUESTED', 'CRITICAL_CORRECTION'];
  for (const trigger of triggers) {
    const { id, graph, mode, evidenceIdentity, writebackRefs } = caseState;
    const triggeredCase = openRecallCase({
      id, graph, mode, evidenceIdentity, writebackRefs, event: { ...event, id: `event-${trigger}`, trigger },
    });
    assert.equal(triggeredCase.decisions.length, 2);
  }
});

test('rejects an event timestamp that is not calendar-valid RFC3339', () => {
  const caseState = createCase();
  const { id, graph, mode, evidenceIdentity, writebackRefs } = caseState;
  assert.throws(
    () => openRecallCase({
      id, graph, mode, evidenceIdentity, writebackRefs,
      event: { ...event, occurredAt: '2026-02-30T00:00:00.000Z' },
    }),
    /invalid event timestamp/,
  );
});

test('open, approval, and resolution boundaries reject unsafe exact-schema inputs', () => {
  const input = openInput();
  let eventReads = 0;
  const accessorInput = { ...input };
  Object.defineProperty(accessorInput, 'event', { enumerable: true, get: () => { eventReads += 1; return event; } });
  assert.throws(() => openRecallCase(accessorInput), /unsupported canonical value/);
  assert.equal(eventReads, 0);
  let eventFieldReads = 0;
  const accessorEvent = { ...event };
  Object.defineProperty(accessorEvent, 'id', { enumerable: true, get: () => { eventFieldReads += 1; return event.id; } });
  assert.throws(() => openRecallCase({ ...input, event: accessorEvent }), /unsupported canonical value/);
  assert.equal(eventFieldReads, 0);
  let graphReads = 0;
  const graphInput = { ...input };
  Object.defineProperty(graphInput, 'graph', { enumerable: true, get: () => { graphReads += 1; return input.graph; } });
  assert.throws(() => openRecallCase(graphInput), /unsupported canonical value/);
  assert.equal(graphReads, 0);
  assert.throws(() => openRecallCase({ ...input, extra: 'unknown' } as typeof input), /invalid recall data/);
  const caseState = createCase({ uncertain: true });
  const approval = approvalFor(caseState, 'urn:model:fraud');
  let approvalReads = 0;
  const accessorApproval = { ...approval };
  Object.defineProperty(accessorApproval, 'assetId', { enumerable: true, get: () => { approvalReads += 1; return approval.assetId; } });
  assert.throws(() => approveDisposition(caseState, accessorApproval), /unsupported canonical value/);
  assert.equal(approvalReads, 0);
  assert.throws(() => approveDisposition(caseState, { ...approval, extra: 'unknown' } as typeof approval), /invalid recall data/);
  const resolution = resolutionFor();
  let resolutionReads = 0;
  const accessorResolution = { ...resolution };
  Object.defineProperty(accessorResolution, 'uncertaintyId', { enumerable: true, get: () => { resolutionReads += 1; return resolution.uncertaintyId; } });
  assert.throws(() => resolveUncertainty(caseState, accessorResolution), /unsupported canonical value/);
  assert.equal(resolutionReads, 0);
  assert.throws(() => resolveUncertainty(caseState, { ...resolution, extra: 'unknown' } as typeof resolution), /invalid recall data/);
});

test('requires exactly one human approval for every valid disposition', () => {
  const dispositions: readonly Disposition[] = [
    'exclude_future_training', 'retrain', 'unlearn', 'retire', 'lawful_exemption',
  ];
  for (const disposition of dispositions) {
    const caseState = createCase({ writeback: true });
    const approved = approveDisposition(caseState, {
      assetId: 'urn:model:fraud', disposition, approver: 'human@example.com',
      approvedAt: '2026-08-09T11:00:00.000Z', revisionDigest: caseState.revisionDigest,
    });
    assert.equal(approved.decisions[1]?.approval?.disposition, disposition);
    assert.throws(() => approve(approved, 'urn:model:fraud'), /asset already has a current approval/);
  }
});

test('keeps earlier approvals current while other assets are approved', () => {
  const firstApproved = approve(createCase({ writeback: true }), 'urn:model:fraud');
  const finalCase = approve(firstApproved, 'urn:deployment:fraud-api');
  assert.equal(finalCase.decisions[0]?.approval?.revisionDigest, finalCase.revisionDigest);
  assert.deepEqual(evaluateClosure(finalCase), { closable: true, blockers: [] });
});

test('rejects stale approvals and accepts lawful exemptions with human approval', () => {
  const caseState = createCase({ writeback: true });
  assert.throws(
    () => approveDisposition(caseState, {
      assetId: 'urn:model:fraud', disposition: 'retrain', approver: 'human@example.com',
      approvedAt: '2026-08-09T11:00:00.000Z', revisionDigest: 'stale',
    }),
    /stale approval revision digest/,
  );
  const exemption = approveDisposition(caseState, {
    assetId: 'urn:model:fraud', disposition: 'lawful_exemption', approver: 'human@example.com',
    approvedAt: '2026-08-09T11:00:00.000Z', revisionDigest: caseState.revisionDigest,
  });
  assert.equal(exemption.decisions[1]?.approval?.disposition, 'lawful_exemption');
});

test('blocks uncertain and ownerless assets until uncertainty is resolved', () => {
  const uncertainCase = createCase({ uncertain: true, missingOwner: true, writeback: true });
  const initial = evaluateClosure(uncertainCase);
  assert.ok(initial.blockers.includes('missing owner: urn:model:fraud'));
  assert.ok(initial.blockers.includes('unresolved uncertainty: uncertainty:model-fraud'));
  const resolved = resolveUncertainty(uncertainCase, {
    uncertaintyId: 'uncertainty:model-fraud', resolvedBy: 'human@example.com',
    resolvedAt: '2026-08-09T11:00:00.000Z', note: 'confirmed lineage',
  });
  assert.ok(resolved.revisionDigest !== uncertainCase.revisionDigest);
});

test('material uncertainty resolution invalidates and permits replacement of earlier approvals', () => {
  const initial = createCase({ uncertain: true, writeback: true });
  const initiallyApproved = approve(initial, 'urn:model:fraud');
  const resolved = resolveUncertainty(initiallyApproved, {
    uncertaintyId: 'uncertainty:model-fraud', resolvedBy: 'human@example.com',
    resolvedAt: '2026-08-09T11:00:00.000Z', note: 'confirmed lineage',
  });
  assert.ok(evaluateClosure(resolved).blockers.includes('missing approved disposition: urn:model:fraud'));
  const reapproved = approve(resolved, 'urn:model:fraud');
  const closed = approve(reapproved, 'urn:deployment:fraud-api');
  assert.deepEqual(evaluateClosure(closed), { closable: true, blockers: [] });
});

test('direct immutable evidence changes make earlier approvals stale', () => {
  const initial = createCase({ writeback: true });
  const modelApproved = approve(initial, 'urn:model:fraud');
  const approved = approve(modelApproved, 'urn:deployment:fraud-api');
  const changed = {
    ...approved,
    event: { ...approved.event, evidence: { notice: 'revocation-43' } },
  };
  const evaluation = evaluateClosure(changed);
  assert.ok(evaluation.blockers.includes('revision digest mismatch'));
  assert.ok(evaluation.blockers.includes('missing approved disposition: urn:model:fraud'));
  assert.ok(evaluation.blockers.includes('missing approved disposition: urn:deployment:fraud-api'));
  assert.throws(
    () => approveDisposition(changed, {
      assetId: 'urn:model:fraud', disposition: 'retrain', approver: 'human@example.com',
      approvedAt: '2026-08-09T12:00:00.000Z', revisionDigest: approved.revisionDigest,
    }),
    /stale approval revision digest/,
  );
});

test('revision digest rejects extended raw graph nodes before normalization', () => {
  const clean = closedCase();
  const reordered = {
    ...clean,
    graph: { nodes: [...clean.graph.nodes].reverse(), edges: [...clean.graph.edges].reverse() },
  };
  assert.equal(computeRevisionDigest(clean), computeRevisionDigest(reordered));
  const nodes = [...clean.graph.nodes];
  Object.defineProperty(nodes, 'extra', { value: 'erased by normalization', enumerable: true });
  const invalid = { ...clean, graph: { ...clean.graph, nodes } };
  assert.throws(() => computeRevisionDigest(invalid), /unsupported canonical value/);
});

test('revision and approval boundaries reject non-enumerable semantic fields without reads', () => {
  const caseState = closedCase();
  const hiddenActor = { ...caseState.event };
  Object.defineProperty(hiddenActor, 'actor', { value: caseState.event.actor, enumerable: false });
  assert.throws(() => computeRevisionDigest({ ...caseState, event: hiddenActor }), /unsupported canonical value/);
  const approval = approvalFor(caseState, 'urn:model:fraud');
  let reads = 0;
  Object.defineProperty(approval, 'assetId', { enumerable: false, get: () => { reads += 1; return 'urn:model:fraud'; } });
  assert.throws(() => approveDisposition(caseState, approval), /unsupported canonical value/);
  assert.equal(reads, 0);
});

test('revision digest rejects extended raw decisions before projection', () => {
  const clean = closedCase();
  const decisions = [...clean.decisions];
  Object.defineProperty(decisions, 'extra', { value: 'erased by projection', enumerable: true });
  const invalid = { ...clean, decisions };
  assert.throws(() => computeRevisionDigest(invalid), /unsupported canonical value/);
});

test('revision digest rejects enumerable undefined decision fields before projection', () => {
  const clean = closedCase();
  const decisions = clean.decisions.map((decision, index) => index === 0
    ? { ...decision, extra: undefined }
    : decision);
  const invalid = { ...clean, decisions } as unknown as RecallCase;
  assert.throws(() => computeRevisionDigest(invalid), /unsupported canonical value/);
});

test('revision digest rejects semantic-invalid raw source records', () => {
  const clean = closedCase();
  const invalid: readonly (readonly [string, RecallCase])[] = [
    ['mode', { ...clean, mode: 'bogus' } as unknown as RecallCase],
    ['evidence identity', { ...clean, evidenceIdentity: ' ' }],
    ['event trigger', { ...clean, event: { ...clean.event, trigger: 'BOGUS' } } as unknown as RecallCase],
    ['node type', { ...clean, graph: { ...clean.graph, nodes: clean.graph.nodes.map((node) => node.id === 'urn:model:fraud' ? { ...node, type: 'bogus' } : node) } } as unknown as RecallCase],
    ['decision disposition', replaceModelDecision(clean, { proposedDisposition: 'bogus' })],
    ['approval timestamp', replaceModelApproval(clean, { approvedAt: 'invalid' })],
    ['approval disposition', replaceModelApproval(clean, { disposition: 'bogus' })],
    ['approval asset', replaceModelApproval(clean, { assetId: 'urn:model:other' })],
    ['decision asset', { ...clean, decisions: [...clean.decisions, { assetId: 'urn:model:unknown' }] } as unknown as RecallCase],
    ['resolution', { ...createIntermediateUncertainCase(), uncertaintyResolutions: [{ uncertaintyId: 'uncertainty:feature', resolvedBy: 'resolver@example.com', resolvedAt: '2026-08-09T12:00:00.000Z', note: '' }] }],
    ['resolution target', { ...createIntermediateUncertainCase(), uncertaintyResolutions: [{ uncertaintyId: 'unknown', resolvedBy: 'resolver@example.com', resolvedAt: '2026-08-09T12:00:00.000Z', note: 'invalid target' }] }],
  ];
  for (const [label, caseState] of invalid) {
    assert.throws(() => computeRevisionDigest(caseState), /invalid recall data/, label);
  }
});

test('unknown decision fields cannot share a revision digest or close a case', () => {
  const clean = closedCase();
  const decisions = clean.decisions.map((decision, index) => index === 0
    ? { ...decision, extra: 'erased by projection' }
    : decision);
  const invalid = { ...clean, decisions } as unknown as RecallCase;
  assert.throws(() => computeRevisionDigest(invalid), /invalid recall data/);
  assert.equal(evaluateClosure(invalid).closable, false);
  assert.ok(evaluateClosure(invalid).blockers.includes('invalid decision record'));
});

test('revision and closure require decisions only for impacted assets', () => {
  const clean = closedCase();
  const missing = { ...clean, decisions: clean.decisions.filter((decision) => decision.assetId !== 'urn:model:fraud') };
  assert.throws(() => computeRevisionDigest(missing), /invalid recall data/);
  assert.equal(evaluateClosure(missing).closable, false);
  const graph = {
    ...clean.graph,
    nodes: [...clean.graph.nodes, { id: 'urn:model:isolated', type: 'model' as const, owner: 'ml@example.com' }],
  };
  const isolated = { ...clean, graph, decisions: [...clean.decisions, { assetId: 'urn:model:isolated' }] };
  assert.throws(() => computeRevisionDigest(isolated), /invalid recall data/);
  assert.equal(evaluateClosure(isolated).closable, false);
});

test('revision and receipt reject resolutions for unreachable uncertainties', () => {
  const source = createIntermediateUncertainCase();
  const graph = {
    ...source.graph,
    nodes: [...source.graph.nodes, {
      id: 'urn:feature:isolated', type: 'feature' as const, owner: 'feature@example.com',
      uncertainty: { id: 'uncertainty:isolated', description: 'not reachable' },
    }],
  };
  const invalid = {
    ...source,
    graph,
    uncertaintyResolutions: [{
      uncertaintyId: 'uncertainty:isolated', resolvedBy: 'resolver@example.com',
      resolvedAt: '2026-08-09T12:00:00.000Z', note: 'invalid target',
    }],
  };
  assert.throws(() => computeRevisionDigest(invalid), /invalid recall data/);
  assert.throws(() => createReceiptPayload(invalid), /invalid recall data/);
});

test('revision and closure reject accessor-backed cases without invoking getters', () => {
  let digestReads = 0;
  const digestCase = accessorEventCase(closedCase(), () => { digestReads += 1; });
  assert.throws(() => computeRevisionDigest(digestCase), /unsupported canonical value/);
  assert.equal(digestReads, 0);
  let closureReads = 0;
  const closureCase = accessorEventCase(closedCase(), () => { closureReads += 1; });
  assert.doesNotThrow(() => evaluateClosure(closureCase));
  assert.equal(evaluateClosure(closureCase).closable, false);
  assert.equal(closureReads, 0);
});

test('intermediate lineage uncertainty blocks closure until resolved and reapproved', () => {
  const initial = createIntermediateUncertainCase();
  const modelApproved = approve(initial, 'urn:model:fraud');
  const approved = approve(modelApproved, 'urn:deployment:fraud-api');
  assert.ok(evaluateClosure(approved).blockers.includes('unresolved uncertainty: uncertainty:feature'));
  const resolved = resolveUncertainty(approved, {
    uncertaintyId: 'uncertainty:feature', resolvedBy: 'human@example.com',
    resolvedAt: '2026-08-09T12:00:00.000Z', note: 'feature linkage confirmed',
  });
  const modelReapproved = approve(resolved, 'urn:model:fraud');
  const finalCase = approve(modelReapproved, 'urn:deployment:fraud-api');
  assert.deepEqual(evaluateClosure(finalCase), { closable: true, blockers: [] });
});

test('rejects invalid human approval and resolution records', () => {
  const caseState = createCase({ uncertain: true, writeback: true });
  assert.throws(() => approveDisposition(caseState, { assetId: 'urn:model:fraud', disposition: 'retrain', approver: 'human@example.com', approvedAt: '', revisionDigest: caseState.revisionDigest }), /approval requires valid timestamp/);
  assert.throws(() => approveDisposition(caseState, { assetId: 'urn:model:fraud', disposition: 'retrain', approver: 'human@example.com', approvedAt: 'invalid', revisionDigest: caseState.revisionDigest }), /approval requires valid timestamp/);
  assert.throws(() => resolveUncertainty(caseState, { uncertaintyId: 'uncertainty:model-fraud', resolvedBy: 'human@example.com', resolvedAt: '', note: 'confirmed' }), /uncertainty resolution requires valid timestamp/);
  assert.throws(() => resolveUncertainty(caseState, { uncertaintyId: 'uncertainty:model-fraud', resolvedBy: 'human@example.com', resolvedAt: 'invalid', note: 'confirmed' }), /uncertainty resolution requires valid timestamp/);
  assert.throws(() => resolveUncertainty(caseState, { uncertaintyId: 'uncertainty:model-fraud', resolvedBy: 'human@example.com', resolvedAt: '2026-08-09T12:00:00.000Z', note: '' }), /uncertainty resolution requires note/);
});

test('closure rejects malformed hydrated approval records and duplicate decisions', () => {
  const valid = closedCase();
  const malformed = [
    replaceModelApproval(valid, { disposition: 'bogus' }),
    replaceModelApproval(valid, { approver: '   ' }),
    replaceModelApproval(valid, { approvedAt: '' }),
    replaceModelApproval(valid, { approvedAt: 'invalid' }),
    replaceModelApproval(valid, { assetId: 'urn:model:other' }),
    replaceModelApproval(valid, { revisionDigest: 'stale' }),
    duplicateModelDecision(valid),
  ];
  for (const caseState of malformed) {
    assert.equal(evaluateClosure(caseState).closable, false);
  }
  assert.ok(evaluateClosure(malformed[0]).blockers.includes('invalid approval: urn:model:fraud'));
  assert.ok(evaluateClosure(malformed[6]).blockers.includes('invalid decision count: urn:model:fraud'));
});

test('closure rejects malformed or duplicate hydrated uncertainty resolutions', () => {
  const caseState = createIntermediateUncertainCase();
  const resolutions = [
    [{ uncertaintyId: 'uncertainty:feature', resolvedBy: ' ', resolvedAt: '2026-08-09T12:00:00.000Z', note: 'confirmed' }],
    [{ uncertaintyId: 'uncertainty:feature', resolvedBy: 'resolver@example.com', resolvedAt: '', note: 'confirmed' }],
    [{ uncertaintyId: 'uncertainty:feature', resolvedBy: 'resolver@example.com', resolvedAt: 'invalid', note: 'confirmed' }],
    [{ uncertaintyId: 'uncertainty:feature', resolvedBy: 'resolver@example.com', resolvedAt: '2026-08-09T12:00:00.000Z', note: '' }],
    [
      { uncertaintyId: 'uncertainty:feature', resolvedBy: 'resolver@example.com', resolvedAt: '2026-08-09T12:00:00.000Z', note: 'confirmed' },
      { uncertaintyId: 'uncertainty:feature', resolvedBy: 'resolver@example.com', resolvedAt: '2026-08-09T12:01:00.000Z', note: 'confirmed again' },
    ],
  ];
  for (const uncertaintyResolutions of resolutions) {
    const hydrated = { ...caseState, uncertaintyResolutions } as unknown as RecallCase;
    assert.ok(evaluateClosure(hydrated).blockers.includes('unresolved uncertainty: uncertainty:feature'));
  }
});

test('closure fails closed without throwing for malformed hydrated graph data', () => {
  const malformed = adversarialGraphCases(closedCase());
  const blockers = [
    'invalid graph node type', 'invalid graph node owner', 'invalid graph source node',
    'invalid graph edge endpoint', 'invalid graph uncertainty',
  ];
  for (const [index, caseState] of malformed.entries()) {
    assert.doesNotThrow(() => evaluateClosure(caseState));
    const evaluation = evaluateClosure(caseState);
    assert.equal(evaluation.closable, false);
    assert.ok(evaluation.blockers.includes(blockers[index]));
  }
});

test('closure rejects malformed hydrated case envelopes and unknown records', () => {
  const valid = closedCase();
  const malformed: readonly (readonly [RecallCase, string])[] = [
    [{ ...valid, id: ' ' } as unknown as RecallCase, 'invalid case id'],
    [{ ...valid, evidenceIdentity: ' ' } as unknown as RecallCase, 'invalid evidence identity'],
    [{ ...valid, mode: 'bogus' } as unknown as RecallCase, 'invalid case mode'],
    [{ ...valid, status: 'bogus' } as unknown as RecallCase, 'invalid case status'],
    [{ ...valid, event: { ...valid.event, actor: ' ' } } as unknown as RecallCase, 'invalid event actor'],
    [{ ...valid, event: { ...valid.event, evidence: { notice: 42 } } } as unknown as RecallCase, 'invalid event evidence'],
    [{ ...valid, writebackRefs: { required: 'bad', successful: [] } } as unknown as RecallCase, 'invalid writeback refs'],
    [{ ...valid, decisions: [...valid.decisions, null] } as unknown as RecallCase, 'invalid decisions'],
    [{ ...createIntermediateUncertainCase(), uncertaintyResolutions: [null] } as unknown as RecallCase, 'invalid uncertainty resolutions'],
    [{ ...valid, decisions: [...valid.decisions, { assetId: 'urn:model:unknown' }] } as unknown as RecallCase, 'invalid decision asset'],
    [{ ...createIntermediateUncertainCase(), uncertaintyResolutions: [{ uncertaintyId: 'unknown', resolvedBy: 'resolver@example.com', resolvedAt: '2026-08-09T12:00:00.000Z', note: 'invalid target' }] } as unknown as RecallCase, 'invalid uncertainty resolution'],
  ];
  for (const [value, blocker] of malformed) {
    assert.doesNotThrow(() => evaluateClosure(value));
    assert.equal(evaluateClosure(value).closable, false);
    assert.ok(evaluateClosure(value).blockers.includes(blocker));
  }
});

test('closure fails closed before hashing arbitrary hydrated revision material', () => {
  const valid = closedCase();
  const malformed: readonly (readonly [RecallCase, string])[] = [
    [{ ...createIntermediateUncertainCase(), uncertaintyResolutions: [{ uncertaintyId: 'uncertainty:feature', resolvedBy: 'resolver@example.com', resolvedAt: '2026-08-09T12:00:00.000Z', note: 1n }] } as unknown as RecallCase, 'invalid revision material'],
    [{ ...valid, event: { ...valid.event, extra: 1n } } as unknown as RecallCase, 'invalid revision material'],
    [{ ...valid, graph: { ...valid.graph, nodes: valid.graph.nodes.map((node) => node.id === 'urn:model:fraud' ? { ...node, governance: { score: 1 } } : node) } } as unknown as RecallCase, 'invalid graph governance'],
    [{ ...valid, decisions: valid.decisions.map((decision) => decision.assetId === 'urn:model:fraud' ? { ...decision, approval: { ...decision.approval, approvedAt: 1 } } : decision) } as unknown as RecallCase, 'invalid approval: urn:model:fraud'],
  ];
  for (const [caseState, blocker] of malformed) {
    assert.doesNotThrow(() => evaluateClosure(caseState));
    assert.equal(evaluateClosure(caseState).closable, false);
    assert.ok(evaluateClosure(caseState).blockers.includes(blocker));
  }
});

test('closure rejects lossy hydrated undefined fields and digest-consistent sparse decisions', () => {
  const valid = closedCase();
  const undefinedEvent = { ...valid, event: { ...valid.event, extra: undefined } } as unknown as RecallCase;
  assert.deepEqual(evaluateClosure(undefinedEvent), {
    closable: false,
    blockers: ['invalid revision material'],
  });
  const decisions = [...valid.decisions];
  decisions.length += 1;
  const sparse = { ...valid, decisions } as RecallCase;
  assert.throws(() => computeRevisionDigest(sparse), /unsupported canonical value/);
  assert.deepEqual(evaluateClosure(sparse), {
    closable: false,
    blockers: ['invalid revision material'],
  });
});

test('closure reports cyclic hydrated material without throwing', () => {
  const evidence: Record<string, unknown> = {};
  evidence.self = evidence;
  const caseState = {
    ...closedCase(),
    event: { ...event, evidence },
  } as unknown as RecallCase;
  assert.doesNotThrow(() => evaluateClosure(caseState));
  assert.deepEqual(evaluateClosure(caseState), {
    closable: false,
    blockers: ['invalid revision material'],
  });
});

test('canonical own __proto__ evidence changes revision, receipt, and approval validity', () => {
  const approved = closedCase();
  const first = { ...approved, event: { ...approved.event, evidence: protoEvidence('first') } };
  const changed = { ...approved, event: { ...approved.event, evidence: protoEvidence('changed') } };
  assert.match(JSON.stringify(changed.event.evidence), /"__proto__":"changed"/);
  assert.notEqual(computeRevisionDigest(first), computeRevisionDigest(changed));
  assert.notEqual(
    createIntegrityReceipt(createReceiptPayload(first)).digest,
    createIntegrityReceipt(createReceiptPayload(changed)).digest,
  );
  assert.ok(evaluateClosure(changed).blockers.includes('revision digest mismatch'));
});

test('inherited optional fields are ignored without invoking prototype getters', () => {
  const caseState = createCase({ missingOwner: true, writeback: true });
  const revisionDigest = computeRevisionDigest(caseState);
  const receiptDigest = createIntegrityReceipt(createReceiptPayload(caseState)).digest;
  const reads: Record<string, number> = { owner: 0, governance: 0, uncertainty: 0, proposedDisposition: 0, approval: 0 };
  withPrototypeGetters(reads, () => {
    const evaluation = evaluateClosure(caseState);
    assert.ok(evaluation.blockers.includes('missing owner: urn:model:fraud'));
    assert.ok(evaluation.blockers.includes('missing approved disposition: urn:model:fraud'));
    assert.equal(computeRevisionDigest(caseState), revisionDigest);
    assert.equal(createIntegrityReceipt(createReceiptPayload(caseState)).digest, receiptDigest);
    assert.deepEqual(findImpactedAssets(caseState.graph, event.sourceUrn).blockers.uncertainties, []);
  });
  assert.deepEqual(reads, { owner: 0, governance: 0, uncertainty: 0, proposedDisposition: 0, approval: 0 });
});

function withPrototypeGetters(reads: Record<string, number>, callback: () => void): void {
  const names = Object.keys(reads);
  const originals = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(Object.prototype, name)]));
  try {
    for (const name of names) Object.defineProperty(Object.prototype, name, { configurable: true, get: () => { reads[name] += 1; return inheritedValue(name); } });
    callback();
  } finally {
    for (const name of names) restorePrototypeProperty(name, originals.get(name));
  }
}

function inheritedValue(name: string): unknown {
  if (name === 'owner') return 'inherited@example.com';
  if (name === 'governance') return { policy: 'inherited' };
  if (name === 'uncertainty') return { id: 'inherited', description: 'inherited' };
  if (name === 'proposedDisposition') return 'retrain';
  return { assetId: 'urn:model:fraud', disposition: 'retrain', approver: 'inherited@example.com', approvedAt: '2026-08-09T11:00:00.000Z', revisionDigest: 'inherited' };
}

function restorePrototypeProperty(name: string, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(Object.prototype, name, descriptor);
  else delete (Object.prototype as Record<string, unknown>)[name];
}

test('closure enforces writeback references as nonempty unique subsets', () => {
  const valid = closedCase();
  const malformed = [
    { required: [], successful: [] },
    { required: ['closure', 'closure'], successful: ['closure'] },
    { required: ['closure'], successful: ['closure', 'closure'] },
    { required: ['closure'], successful: ['closure', 'unknown'] },
  ];
  for (const writebackRefs of malformed) {
    const hydrated = { ...valid, writebackRefs } as unknown as RecallCase;
    assert.equal(evaluateClosure(hydrated).closable, false);
    assert.ok(evaluateClosure(hydrated).blockers.includes('invalid writeback refs'));
  }
  const partial = { ...valid, writebackRefs: { required: ['warning', 'closure'], successful: ['warning'] } };
  assert.deepEqual(evaluateClosure(partial), {
    closable: false,
    blockers: ['missing successful writeback: closure'],
  });
});

test('closure rejects lossy writeback reference arrays', () => {
  const valid = closedCase();
  const sparseRequired = new Array<string>(1);
  const extendedSuccessful = [...valid.writebackRefs.successful];
  Object.defineProperty(extendedSuccessful, 'extra', { value: 'erased by JSON', enumerable: true });
  const malformed = [
    { required: sparseRequired, successful: [] },
    { required: valid.writebackRefs.required, successful: extendedSuccessful },
  ];
  for (const writebackRefs of malformed) {
    const hydrated = { ...valid, writebackRefs } as unknown as RecallCase;
    assert.deepEqual(evaluateClosure(hydrated), {
      closable: false,
      blockers: ['invalid revision material'],
    });
  }
});

function createIntermediateUncertainCase(): RecallCase {
  return openRecallCase({
    id: 'case-intermediate', event, mode: 'fixture', evidenceIdentity: 'fixture:intermediate:v1',
    graph: {
      nodes: [
        { id: event.sourceUrn, type: 'dataset', owner: 'data@example.com' },
        { id: 'urn:feature:uncertain', type: 'feature', owner: 'feature@example.com', uncertainty: { id: 'uncertainty:feature', description: 'pending feature lineage' } },
        { id: 'urn:model:fraud', type: 'model', owner: 'ml@example.com' },
        { id: 'urn:deployment:fraud-api', type: 'deployment', owner: 'ops@example.com' },
      ],
      edges: [
        { from: event.sourceUrn, to: 'urn:feature:uncertain' }, { from: 'urn:feature:uncertain', to: 'urn:model:fraud' },
        { from: 'urn:model:fraud', to: 'urn:deployment:fraud-api' },
      ],
    },
    writebackRefs: { required: ['fixture:closure'], successful: ['fixture:closure'] },
  });
}

function closedCase(): RecallCase {
  const modelApproved = approve(createCase({ writeback: true }), 'urn:model:fraud');
  return approve(modelApproved, 'urn:deployment:fraud-api');
}

function replaceModelApproval(caseState: RecallCase, fields: Readonly<Record<string, unknown>>): RecallCase {
  const decisions = caseState.decisions.map((decision) => {
    if (decision.assetId !== 'urn:model:fraud') return decision;
    return { ...decision, approval: { ...decision.approval, ...fields } };
  });
  return { ...caseState, decisions } as unknown as RecallCase;
}

function replaceModelDecision(caseState: RecallCase, fields: Readonly<Record<string, unknown>>): RecallCase {
  const decisions = caseState.decisions.map((decision) => {
    if (decision.assetId !== 'urn:model:fraud') return decision;
    return { ...decision, ...fields };
  });
  return { ...caseState, decisions } as unknown as RecallCase;
}

function duplicateModelDecision(caseState: RecallCase): RecallCase {
  const modelDecision = caseState.decisions.find((decision) => decision.assetId === 'urn:model:fraud');
  return { ...caseState, decisions: [...caseState.decisions, modelDecision] } as unknown as RecallCase;
}

function adversarialGraphCases(caseState: RecallCase): readonly RecallCase[] {
  const graph = caseState.graph;
  return [
    { ...caseState, graph: { ...graph, nodes: graph.nodes.map((node) => node.id === 'urn:model:fraud' ? { ...node, type: 'bogus' } : node) } },
    { ...caseState, graph: { ...graph, nodes: graph.nodes.map((node) => node.id === 'urn:model:fraud' ? { ...node, owner: ' ' } : node) } },
    { ...caseState, graph: { ...graph, nodes: graph.nodes.filter((node) => node.id !== event.sourceUrn) } },
    { ...caseState, graph: { ...graph, edges: [...graph.edges, { from: event.sourceUrn, to: 'urn:model:unknown' }] } },
    { ...caseState, graph: { ...graph, nodes: graph.nodes.map((node) => node.id === 'urn:model:fraud' ? { ...node, uncertainty: { id: 'u-invalid', description: ' ' } } : node) } },
  ] as unknown as readonly RecallCase[];
}

function protoEvidence(value: string): Readonly<Record<string, string>> {
  const evidence = Object.create(null) as Record<string, string>;
  Object.defineProperty(evidence, '__proto__', { value, enumerable: true });
  return evidence;
}

function accessorEventCase(caseState: RecallCase, onRead: () => void): RecallCase {
  const accessorCase = { ...caseState } as RecallCase;
  Object.defineProperty(accessorCase, 'event', {
    enumerable: true,
    get: () => { onRead(); return caseState.event; },
  });
  return accessorCase;
}
