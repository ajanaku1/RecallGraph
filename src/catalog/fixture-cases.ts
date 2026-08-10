import { approveDisposition, openRecallCase } from '../core/recall.ts';
import type { EvidenceMode, NormalizedGraph, RecallCase, RecallEvent, TriggerType } from '../core/types.ts';

export interface FixtureCase {
  mode: EvidenceMode;
  evidenceIdentity: string;
  caseState: RecallCase;
}

export function createLicenseRevokedFixtureCase(): FixtureCase {
  const evidenceIdentity = 'fixture:license-revoked:v1';
  const opened = openFixtureCase('LICENSE_REVOKED', evidenceIdentity, licenseRevokedGraph());
  const caseState = approveDisposition(opened, {
    assetId: 'urn:deployment:recommendation-api', disposition: 'retire',
    approver: 'fixture.approver@example.com', approvedAt: '2026-08-09T10:05:00.000Z',
    revisionDigest: opened.revisionDigest,
  });
  return { mode: 'fixture', evidenceIdentity, caseState };
}

export function createErasureRequestedFixtureCase(): FixtureCase {
  const evidenceIdentity = 'fixture:erasure-requested:v1';
  return { mode: 'fixture', evidenceIdentity, caseState: openFixtureCase('ERASURE_REQUESTED', evidenceIdentity, erasureGraph()) };
}

export function createCriticalCorrectionFixtureCase(): FixtureCase {
  const evidenceIdentity = 'fixture:critical-correction:v1';
  return { mode: 'fixture', evidenceIdentity, caseState: openFixtureCase('CRITICAL_CORRECTION', evidenceIdentity, correctionGraph()) };
}

function openFixtureCase(trigger: TriggerType, evidenceIdentity: string, graph: NormalizedGraph): RecallCase {
  const event = createFixtureEvent(trigger, evidenceIdentity);
  return openRecallCase({
    id: `case:${evidenceIdentity}`, event, graph, mode: 'fixture', evidenceIdentity,
    writebackRefs: { required: ['fixture:closure-writeback'], successful: [] },
  });
}

function createFixtureEvent(trigger: TriggerType, evidenceIdentity: string): RecallEvent {
  return {
    id: `event:${evidenceIdentity}`, trigger, sourceUrn: 'urn:dataset:training-corpus',
    evidence: { identity: evidenceIdentity, source: 'recorded fixture snapshot; not live evidence' },
    actor: 'fixture.commander@example.com', occurredAt: '2026-08-09T10:00:00.000Z',
  };
}

function licenseRevokedGraph(): NormalizedGraph {
  return {
    nodes: [
      { id: 'urn:dataset:training-corpus', type: 'dataset', owner: 'data@example.com' },
      { id: 'urn:feature:relevance-signals', type: 'feature', owner: 'feature@example.com' },
      { id: 'urn:model:ranking-v2', type: 'model', owner: 'ranking@example.com' },
      { id: 'urn:model:relevance-v4', type: 'model', owner: 'relevance@example.com' },
      { id: 'urn:deployment:recommendation-api', type: 'deployment', owner: 'ops@example.com' },
    ],
    edges: [
      { from: 'urn:dataset:training-corpus', to: 'urn:feature:relevance-signals' },
      { from: 'urn:feature:relevance-signals', to: 'urn:model:ranking-v2' },
      { from: 'urn:feature:relevance-signals', to: 'urn:model:relevance-v4' },
      { from: 'urn:model:ranking-v2', to: 'urn:deployment:recommendation-api' },
    ],
  };
}

function erasureGraph(): NormalizedGraph {
  return {
    nodes: [
      { id: 'urn:dataset:training-corpus', type: 'dataset', owner: 'data@example.com' },
      { id: 'urn:model:erasure-candidate', type: 'model' },
    ],
    edges: [{ from: 'urn:dataset:training-corpus', to: 'urn:model:erasure-candidate' }],
  };
}

function correctionGraph(): NormalizedGraph {
  return {
    nodes: [
      { id: 'urn:dataset:training-corpus', type: 'dataset', owner: 'data@example.com' },
      { id: 'urn:model:correction-candidate', type: 'model', owner: 'ml@example.com', uncertainty: {
        id: 'uncertainty:correction-candidate', description: 'recorded lineage needs confirmation',
      } },
    ],
    edges: [{ from: 'urn:dataset:training-corpus', to: 'urn:model:correction-candidate' }],
  };
}
