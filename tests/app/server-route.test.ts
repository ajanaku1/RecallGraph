import { describe, expect, it } from 'vitest';
import { POST } from '../../src/app/api/recall/route';

function fixtureRequest(body: object): Request {
  return new Request('http://localhost/api/recall', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('fixture recall server boundary', () => {
  const approvals = ['urn:model:ranking-v2', 'urn:model:relevance-v4'];

  it('requires both approvals and returns a fixture-issued writeback reference', async () => {
    const blocked = await POST(fixtureRequest({ command: 'writeback', approvedAssetIds: [] }));
    const normal = await POST(fixtureRequest({ command: 'writeback', approvedAssetIds: approvals }));
    const failed = await POST(fixtureRequest({ command: 'writeback', approvedAssetIds: approvals, testFailure: true }));
    const retried = await POST(fixtureRequest({ command: 'writeback', approvedAssetIds: approvals, retry: true }));

    expect(blocked.status).toBe(409);
    expect(normal.status).toBe(200);
    expect(failed.status).toBe(503);
    expect((await normal.json()).writeback).toBe('fixture:closure-writeback');
    expect((await retried.json()).writeback).toBe('fixture:closure-writeback');
  });

  it('returns a complete receipt but never exposes a caller-trusted digest', async () => {
    const blocked = await POST(fixtureRequest({ command: 'close', approvedAssetIds: approvals }));
    const forged = await POST(fixtureRequest({
      command: 'close',
      approvedAssetIds: approvals,
      writebackRef: 'fixture:forged-writeback',
    }));
    const closed = await POST(fixtureRequest({
      command: 'close',
      approvedAssetIds: approvals,
      writebackRef: 'fixture:closure-writeback',
    }));

    expect(blocked.status).toBe(409);
    expect(forged.status).toBe(409);
    const result = await closed.json() as { receipt: { payload: unknown; digest: string } };
    expect(result.receipt.payload).toBeDefined();
    expect(result).not.toHaveProperty('trustedReceiptDigest');
    const match = await POST(fixtureRequest({ command: 'verify', receipt: result.receipt }));
    const mismatch = await POST(fixtureRequest({
      command: 'verify',
      receipt: { ...result.receipt, digest: `${result.receipt.digest}mismatch` },
    }));
    expect((await match.json()).match).toBe(true);
    expect((await mismatch.json()).match).toBe(false);
  });

  it('rejects malformed and altered receipt envelopes at the server boundary', async () => {
    const closed = await POST(fixtureRequest({
      command: 'close', approvedAssetIds: approvals, writebackRef: 'fixture:closure-writeback',
    }));
    const result = await closed.json() as { receipt: { payload: Record<string, unknown>; digest: string } };
    const malformed = await POST(fixtureRequest({ command: 'verify', receipt: { digest: result.receipt.digest } }));
    const alteredPayload = await POST(fixtureRequest({
      command: 'verify', receipt: { ...result.receipt, payload: { ...result.receipt.payload, caseId: 'changed' } },
    }));

    expect(malformed.status).toBe(400);
    expect((await alteredPayload.json()).match).toBe(false);
  });
});
