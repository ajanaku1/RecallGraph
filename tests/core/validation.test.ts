import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertValidApprovalInput,
  assertValidReceiptPayload,
  assertValidReceiptSource,
  assertValidResolutionInput,
  assertValidRevisionSource,
  isIntegrityReceiptEnvelope,
  isValidTimestamp,
} from '../../src/core/validation.ts';

test('accepts only calendar-valid RFC3339 timestamps with explicit timezones', () => {
  assert.equal(isValidTimestamp('2024-02-29T23:59:59.123Z'), true);
  assert.equal(isValidTimestamp('2026-08-09T12:30:00+01:00'), true);
  assert.equal(isValidTimestamp('2026-02-30T00:00:00.000Z'), false);
  assert.equal(isValidTimestamp('2025-02-29T00:00:00Z'), false);
  assert.equal(isValidTimestamp('2026-08-09T12:30:00'), false);
  assert.equal(isValidTimestamp('2026-08-09T24:00:00Z'), false);
  assert.equal(isValidTimestamp('2026-08-09T12:60:00Z'), false);
  assert.equal(isValidTimestamp('2026-08-09T12:30:00+24:00'), false);
});

test('exported semantic helpers reject accessors without invoking getters', () => {
  const revision = accessorRecord(['id', 'event', 'graph', 'mode', 'evidenceIdentity', 'status', 'revisionDigest', 'decisions', 'uncertaintyResolutions', 'writebackRefs'], 'id');
  const receiptSource = accessorRecord(['id', 'event', 'graph', 'mode', 'evidenceIdentity', 'revisionDigest', 'decisions', 'uncertaintyResolutions', 'writebackRefs'], 'id');
  const payload = accessorRecord(['caseId', 'event', 'graph', 'evidenceIdentity', 'mode', 'revisionDigest', 'decisions', 'uncertaintyResolutions', 'writebackRefs'], 'caseId');
  const envelope = accessorRecord(['payload', 'digest'], 'digest');
  assert.throws(() => assertValidRevisionSource(revision.value), /unsupported canonical value/);
  assert.throws(() => assertValidReceiptSource(receiptSource.value), /unsupported canonical value/);
  assert.throws(() => assertValidReceiptPayload(payload.value), /unsupported canonical value/);
  assert.equal(isIntegrityReceiptEnvelope(envelope.value), false);
  assert.deepEqual([revision.reads(), receiptSource.reads(), payload.reads(), envelope.reads()], [0, 0, 0, 0]);
});

test('exported approval and resolution helpers enforce complete record shapes', () => {
  const approval = {
    assetId: 'urn:model:fraud', disposition: 'retrain', approver: 'human@example.com',
    approvedAt: '2026-08-09T11:00:00.000Z', revisionDigest: 'digest',
  };
  const resolution = {
    uncertaintyId: 'uncertainty:fraud', resolvedBy: 'human@example.com',
    resolvedAt: '2026-08-09T11:00:00.000Z', note: 'confirmed',
  };
  for (const invalid of [{ ...approval, disposition: 'bogus' }, { ...approval, approver: ' ' }, { ...approval, approvedAt: '2026-02-30T00:00:00Z' }]) {
    assert.throws(() => assertValidApprovalInput(invalid), /invalid recall data/);
  }
  for (const invalid of [{ ...resolution, uncertaintyId: ' ' }, { ...resolution, resolvedAt: 'bad' }, { ...resolution, note: 1 }]) {
    assert.throws(() => assertValidResolutionInput(invalid), /invalid recall data/);
  }
});

function accessorRecord(keys: readonly string[], accessorKey: string): { value: Record<string, unknown>; reads: () => number } {
  let getterReads = 0;
  const value = Object.fromEntries(keys.map((key) => [key, undefined]));
  Object.defineProperty(value, accessorKey, {
    enumerable: true,
    get: () => {
      getterReads += 1;
      return undefined;
    },
  });
  return { value, reads: () => getterReads };
}
