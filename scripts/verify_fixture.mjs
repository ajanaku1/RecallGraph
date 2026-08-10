import assert from 'node:assert/strict';

import { createLicenseRevokedFixtureCase } from '../src/catalog/fixture-cases.ts';
import { findImpactedAssets } from '../src/core/graph.ts';
import { approveDisposition, evaluateClosure } from '../src/core/recall.ts';
import { createIntegrityReceipt, createReceiptPayload, verifyIntegrityReceipt } from '../src/core/receipt.ts';

const fixture = createLicenseRevokedFixtureCase();
const initialCase = fixture.caseState;
const impact = findImpactedAssets(initialCase.graph, initialCase.event.sourceUrn);
const unresolved = initialCase.decisions.filter((decision) => !decision.approval);
const initialClosure = evaluateClosure(initialCase);

assert.equal(impact.impacted.filter((node) => node.type === 'model').length, 2);
assert.equal(impact.impacted.filter((node) => node.type === 'deployment').length, 1);
assert.equal(impact.impacted.length, 3);
assert.equal(unresolved.length, 2);
assert.equal(initialClosure.closable, false);

const approvedCase = approveAll(initialCase, unresolved.map((decision) => decision.assetId));
const finalCase = {
  ...approvedCase,
  writebackRefs: { required: ['fixture:closure-writeback'], successful: ['fixture:closure-writeback'] },
};
const finalClosure = evaluateClosure(finalCase);
assert.equal(finalClosure.closable, true);

const receipt = createIntegrityReceipt(createReceiptPayload(finalCase));
const repeatedReceipt = createIntegrityReceipt(createReceiptPayload(finalCase));
assert.equal(receipt.digest, repeatedReceipt.digest);
assert.equal(verifyIntegrityReceipt(receipt, receipt.digest).match, true);
assert.equal(verifyIntegrityReceipt(receipt, 'different-trusted-digest').match, false);

console.log('fixture: LICENSE_REVOKED evidence=fixture:license-revoked:v1');
console.log('impact: 2 models, 1 deployment (3 descendants); unresolved initially: 2');
console.log('closure: blocked -> closable after 2 human approvals and 1 successful writeback');
console.log(`receipt: stable ${receipt.digest}; trusted match=true mismatch=true`);

function approveAll(caseState, assetIds) {
  let updated = caseState;
  for (const assetId of assetIds) updated = approveAsset(updated, assetId);
  return updated;
}

function approveAsset(caseState, assetId) {
  return approveDisposition(caseState, {
    assetId, disposition: 'retrain', approver: 'fixture.human@example.com',
    approvedAt: '2026-08-09T10:10:00.000Z', revisionDigest: caseState.revisionDigest,
  });
}
