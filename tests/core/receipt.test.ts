import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalJson,
  createReceiptPayload,
  createIntegrityReceipt,
  sha256Canonical,
  verifyIntegrityReceipt,
} from '../../src/core/receipt.ts';
import { computeRevisionDigest } from '../../src/core/recall.ts';
import { normalizeGraph } from '../../src/core/graph.ts';
import type { NormalizedGraph, RecallCase } from '../../src/core/types.ts';

test('canonical JSON and SHA-256 are stable across object key order', () => {
  const first = { z: ['a', { b: 2, a: 1 }], a: true };
  const second = { a: true, z: ['a', { a: 1, b: 2 }] };
  assert.equal(canonicalJson(first), '{"a":true,"z":["a",{"a":1,"b":2}]}');
  assert.equal(sha256Canonical(first), sha256Canonical(second));
});

test('canonical JSON preserves own enumerable __proto__ keys', () => {
  const first = protoRecord('first');
  const second = protoRecord('second');
  assert.equal(canonicalJson(first), '{"__proto__":"first"}');
  assert.notEqual(sha256Canonical(first), sha256Canonical(second));
});

test('canonical JSON rejects lossy undefined properties and non-canonical arrays', () => {
  const undefinedNested = { event: { extra: undefined } };
  const sparse = ['decision'];
  sparse.length = 2;
  const extended = ['decision'] as string[] & { extra?: string };
  extended.extra = 'ignored by JSON';
  assert.throws(() => canonicalJson(undefinedNested), /unsupported canonical value/);
  assert.throws(() => sha256Canonical(sparse), /unsupported canonical value/);
  assert.throws(() => sha256Canonical(extended), /unsupported canonical value/);
});

test('canonical JSON rejects negative zero and enumerable accessors without invoking them', () => {
  let recordReads = 0;
  const record = {};
  Object.defineProperty(record, 'value', { enumerable: true, get: () => { recordReads += 1; return 'value'; } });
  let arrayReads = 0;
  const array = ['value'];
  Object.defineProperty(array, '0', { enumerable: true, get: () => { arrayReads += 1; return 'value'; } });
  assert.equal(canonicalJson(0), '0');
  assert.throws(() => canonicalJson(-0), /unsupported canonical value/);
  assert.throws(() => sha256Canonical(-0), /unsupported canonical value/);
  assert.throws(() => canonicalJson(record), /unsupported canonical value/);
  assert.throws(() => canonicalJson(array), /unsupported canonical value/);
  assert.equal(recordReads, 0);
  assert.equal(arrayReads, 0);
});

test('canonical JSON rejects non-enumerable record data', () => {
  const record = { visible: 'bound' };
  Object.defineProperty(record, 'hidden', { value: 'unbound', enumerable: false });
  assert.throws(() => canonicalJson(record), /unsupported canonical value/);
  assert.throws(() => sha256Canonical(record), /unsupported canonical value/);
});

test('receipt verification detects trusted digest mismatches without authenticity claims', () => {
  const receipt = createIntegrityReceipt(createReceiptPayload(receiptCase()));
  assert.deepEqual(verifyIntegrityReceipt(receipt, receipt.digest), {
    match: true,
    disclaimer: 'Integrity/change detection only; not a signature, authenticity, authorship, provenance, or nonrepudiation proof.',
  });
  assert.deepEqual(verifyIntegrityReceipt(receipt, 'different-trusted-digest'), {
    match: false,
    disclaimer: 'Integrity/change detection only; not a signature, authenticity, authorship, provenance, or nonrepudiation proof.',
  });
});

test('receipt creation and verification reject lossy runtime payloads', () => {
  const payload = createReceiptPayload(receiptCase());
  const invalidEvent = payload.event as unknown as Record<string, unknown>;
  invalidEvent.extra = undefined;
  assert.throws(() => createIntegrityReceipt(payload), /unsupported canonical value/);
  const receipt = { payload, digest: 'trusted-digest' };
  assert.deepEqual(verifyIntegrityReceipt(receipt, 'trusted-digest'), {
    match: false,
    disclaimer: 'Integrity/change detection only; not a signature, authenticity, authorship, provenance, or nonrepudiation proof.',
  });
});

test('receipt payload rejects lossy source graph arrays before normalization', () => {
  const source = receiptCase();
  const extendedNodes = [...source.graph.nodes];
  Object.defineProperty(extendedNodes, 'extra', { value: 'erased by sorting', enumerable: true });
  const sparseEdges = [...source.graph.edges];
  sparseEdges.length += 1;
  const extended = { ...source, graph: { ...source.graph, nodes: extendedNodes } };
  const sparse = { ...source, graph: { ...source.graph, edges: sparseEdges } };
  assert.throws(() => createReceiptPayload(extended), /unsupported canonical value/);
  assert.throws(() => createReceiptPayload(sparse), /unsupported canonical value/);
});

test('receipt source rejects blank revision digests before projecting a payload', () => {
  const source = { ...receiptCase(), revisionDigest: '' };
  assert.throws(() => createReceiptPayload(source), /invalid recall data/);
});

test('receipt public boundaries reject semantic-invalid source and payload records', () => {
  const clean = receiptCase();
  const malformedSources: readonly RecallCase[] = [
    { ...clean, mode: 'bogus' } as unknown as RecallCase,
    { ...clean, graph: { ...clean.graph, edges: clean.graph.edges.map((edge) => ({ ...edge, extra: 'unknown' })) } } as unknown as RecallCase,
    { ...clean, extra: 'erased by receipt projection' } as unknown as RecallCase,
  ];
  for (const source of malformedSources) {
    assert.throws(() => createReceiptPayload(source), /invalid recall data/);
  }
  const payload = {
    ...createReceiptPayload(clean),
    event: { ...clean.event, trigger: 'BOGUS' },
  } as unknown as ReturnType<typeof createReceiptPayload>;
  const digest = sha256Canonical(payload);
  assert.throws(() => createIntegrityReceipt(payload), /invalid recall data/);
  assert.deepEqual(verifyIntegrityReceipt({ payload, digest }, digest), {
    match: false,
    disclaimer: 'Integrity/change detection only; not a signature, authenticity, authorship, provenance, or nonrepudiation proof.',
  });
});

test('direct receipts require normalized payload graphs and exact envelopes', () => {
  const payload = createReceiptPayload(receiptCase());
  const unsorted = {
    ...payload,
    graph: { nodes: [...payload.graph.nodes].reverse(), edges: [payload.graph.edges[1], payload.graph.edges[0], payload.graph.edges[0]] },
  };
  assert.throws(() => createIntegrityReceipt(unsorted), /invalid recall data/);
  const receipt = createIntegrityReceipt(payload);
  const symbolEnvelope = { ...receipt };
  Object.defineProperty(symbolEnvelope, Symbol('extra'), { value: 'unknown', enumerable: true });
  const envelopes: readonly unknown[] = [
    { ...receipt, extra: 'unknown' },
    { payload: receipt.payload, digest: receipt.digest.toUpperCase() },
    { payload: receipt.payload },
    symbolEnvelope,
  ];
  for (const envelope of envelopes) {
    assert.equal(verifyIntegrityReceipt(envelope as typeof receipt, receipt.digest).match, false);
  }
});

test('receipt verification rejects accessor envelopes without invoking getters', () => {
  const receipt = createIntegrityReceipt(createReceiptPayload(receiptCase()));
  let digestReads = 0;
  const digestEnvelope = { ...receipt };
  Object.defineProperty(digestEnvelope, 'digest', { enumerable: true, get: () => { digestReads += 1; return receipt.digest; } });
  assert.equal(verifyIntegrityReceipt(digestEnvelope, receipt.digest).match, false);
  assert.equal(digestReads, 0);
  let payloadReads = 0;
  const payloadEnvelope = { ...receipt };
  Object.defineProperty(payloadEnvelope, 'payload', { enumerable: true, get: () => { payloadReads += 1; return receipt.payload; } });
  assert.equal(verifyIntegrityReceipt(payloadEnvelope, receipt.digest).match, false);
  assert.equal(payloadReads, 0);
});

test('receipt payload canonically includes full event and normalized lineage evidence', () => {
  const payload = createReceiptPayload(receiptCase());
  const serialized = canonicalJson(payload);
  assert.match(serialized, /"actor":"commander@example.com"/);
  assert.match(serialized, /"occurredAt":"2026-08-09T10:00:00.000Z"/);
  assert.match(serialized, /"sourceUrn":"urn:dataset:source"/);
  assert.match(serialized, /"notice":"revocation-42"/);
  assert.match(serialized, /"nodes":\[\{"id":"urn:dataset:source"/);
  assert.match(serialized, /"approver":"human@example.com"/);
  assert.match(serialized, /"approvedAt":"2026-08-09T11:00:00.000Z"/);
});

test('receipt payload binds human uncertainty resolutions', () => {
  const caseState = receiptCase();
  const payload = createReceiptPayload({
    ...caseState,
    graph: {
      ...caseState.graph,
      nodes: caseState.graph.nodes.map((node) => node.id === 'urn:feature:signals'
        ? { ...node, uncertainty: { id: 'u-1', description: 'lineage pending review' } }
        : node),
    },
    uncertaintyResolutions: [{
      uncertaintyId: 'u-1', resolvedBy: 'resolver@example.com',
      resolvedAt: '2026-08-09T12:00:00.000Z', note: 'lineage confirmed',
    }],
  });
  const serialized = canonicalJson(payload);
  assert.match(serialized, /"resolvedBy":"resolver@example.com"/);
  assert.match(serialized, /"resolvedAt":"2026-08-09T12:00:00.000Z"/);
  assert.match(serialized, /"note":"lineage confirmed"/);
});

test('equivalent graph array ordering yields stable revision and receipt digests', () => {
  const first = receiptCase();
  const reordered = {
    ...first,
    graph: {
      nodes: [...first.graph.nodes].reverse(),
      edges: [first.graph.edges[1], first.graph.edges[0], first.graph.edges[0]],
    },
  };
  const firstCase = { ...first, revisionDigest: computeRevisionDigest(first) };
  const reorderedCase = { ...reordered, revisionDigest: computeRevisionDigest(reordered) };
  assert.equal(firstCase.revisionDigest, reorderedCase.revisionDigest);
  assert.equal(
    createIntegrityReceipt(createReceiptPayload(firstCase)).digest,
    createIntegrityReceipt(createReceiptPayload(reorderedCase)).digest,
  );
});

test('Unicode collation-equivalent IDs have locale-independent graph and digest ordering', () => {
  const decisions = [{ assetId: 'urn:model:\u00e9' }, { assetId: 'urn:model:e\u0301' }];
  const first = { ...receiptCase(), graph: unicodeGraph(false), decisions };
  const reversed = { ...receiptCase(), graph: unicodeGraph(true), decisions };
  assert.deepEqual(
    normalizeGraph(first.graph).nodes.map((node) => node.id),
    normalizeGraph(reversed.graph).nodes.map((node) => node.id),
  );
  const firstCase = { ...first, revisionDigest: computeRevisionDigest(first) };
  const reversedCase = { ...reversed, revisionDigest: computeRevisionDigest(reversed) };
  assert.equal(firstCase.revisionDigest, reversedCase.revisionDigest);
  assert.equal(
    createIntegrityReceipt(createReceiptPayload(firstCase)).digest,
    createIntegrityReceipt(createReceiptPayload(reversedCase)).digest,
  );
});

function receiptCase(): RecallCase {
  return {
    id: 'case-1', mode: 'fixture', evidenceIdentity: 'fixture:license-revoked:v1',
    revisionDigest: 'revision-1', status: 'open', uncertaintyResolutions: [],
    decisions: [{
      assetId: 'urn:model:fraud', approval: {
        assetId: 'urn:model:fraud', disposition: 'retrain', approver: 'human@example.com',
        approvedAt: '2026-08-09T11:00:00.000Z', revisionDigest: 'revision-1',
      },
    }],
    event: {
      id: 'event-1', trigger: 'LICENSE_REVOKED', sourceUrn: 'urn:dataset:source',
      evidence: { notice: 'revocation-42' }, actor: 'commander@example.com',
      occurredAt: '2026-08-09T10:00:00.000Z',
    },
    graph: {
      nodes: [
        { id: 'urn:dataset:source', type: 'dataset', owner: 'data@example.com' },
        { id: 'urn:feature:signals', type: 'feature', owner: 'feature@example.com' },
        { id: 'urn:model:fraud', type: 'model', owner: 'ml@example.com' },
      ],
      edges: [
        { from: 'urn:dataset:source', to: 'urn:feature:signals' },
        { from: 'urn:feature:signals', to: 'urn:model:fraud' },
      ],
    },
    writebackRefs: { required: ['datahub:closure'], successful: ['datahub:closure'] },
  };
}

function protoRecord(value: string): Readonly<Record<string, string>> {
  const record = Object.create(null) as Record<string, string>;
  Object.defineProperty(record, '__proto__', { value, enumerable: true });
  return record;
}

function unicodeGraph(reverse: boolean): NormalizedGraph {
  const nodes = [
    { id: 'urn:dataset:source', type: 'dataset' as const, owner: 'data@example.com' },
    { id: 'urn:model:\u00e9', type: 'model' as const, owner: 'ml@example.com' },
    { id: 'urn:model:e\u0301', type: 'model' as const, owner: 'ml@example.com' },
  ];
  const edges = [
    { from: 'urn:dataset:source', to: 'urn:model:\u00e9' },
    { from: 'urn:dataset:source', to: 'urn:model:e\u0301' },
  ];
  return { nodes: reverse ? [...nodes].reverse() : nodes, edges: reverse ? [...edges].reverse() : edges };
}
