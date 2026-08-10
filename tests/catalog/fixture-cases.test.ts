import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCriticalCorrectionFixtureCase,
  createErasureRequestedFixtureCase,
  createLicenseRevokedFixtureCase,
} from '../../src/catalog/fixture-cases.ts';

test('LICENSE_REVOKED planted fixture has two models, one deployment, and two unresolved decisions', () => {
  const fixture = createLicenseRevokedFixtureCase();
  const impacted = fixture.caseState.decisions;
  const unresolved = impacted.filter((decision) => !decision.approval);
  assert.equal(fixture.mode, 'fixture');
  assert.equal(fixture.evidenceIdentity, 'fixture:license-revoked:v1');
  assert.equal(impacted.length, 3);
  assert.equal(unresolved.length, 2);
  assert.deepEqual(impacted.map((decision) => decision.assetId), [
    'urn:deployment:recommendation-api', 'urn:model:ranking-v2', 'urn:model:relevance-v4',
  ]);
});

test('fixture factories have typed alternate triggers and reset their state', () => {
  const erasure = createErasureRequestedFixtureCase();
  const correction = createCriticalCorrectionFixtureCase();
  const first = createLicenseRevokedFixtureCase();
  const second = createLicenseRevokedFixtureCase();
  assert.equal(erasure.caseState.event.trigger, 'ERASURE_REQUESTED');
  assert.equal(correction.caseState.event.trigger, 'CRITICAL_CORRECTION');
  assert.ok(erasure.caseState.graph.nodes.some((node) => !node.owner));
  assert.ok(correction.caseState.graph.nodes.some((node) => node.uncertainty));
  assert.notEqual(first.caseState, second.caseState);
  assert.notEqual(first.caseState.decisions, second.caseState.decisions);
});
