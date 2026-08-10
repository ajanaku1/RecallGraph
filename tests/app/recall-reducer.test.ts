import { describe, expect, it } from 'vitest';
import { initialJourneyState, recallReducer } from '../../src/app/recall-reducer';

describe('recall journey reducer', () => {
  it('keeps approval and writeback failures distinct and supports retry', () => {
    let state = initialJourneyState('urn:model:ranking-v2');
    state = recallReducer(state, { type: 'approval-failure', message: 'Approval unavailable' });
    expect(state.approvalError).toBe('Approval unavailable');
    state = recallReducer(state, { type: 'approve-success', assetId: 'urn:model:ranking-v2' });
    state = recallReducer(state, { type: 'writeback-failure', message: 'Recorded fixture failure' });
    state = recallReducer(state, { type: 'retry-writeback' });

    expect(state.approvedAssetIds).toEqual(['urn:model:ranking-v2']);
    expect(state.approvalError).toBeUndefined();
    expect(state.writeback).toBe('ready');
  });

  it('requires guarded close confirmation before receipt issuance', () => {
    let state = initialJourneyState('urn:model:ranking-v2');
    state = recallReducer(state, { type: 'request-close' });
    expect(state.close).toBe('confirming');
    state = recallReducer(state, { type: 'receipt-issued', receipt: receipt('trusted') });
    expect(state.close).toBe('closed');
  });

  it('records ordered session audit events through receipt verification', () => {
    let state = initialJourneyState('urn:model:ranking-v2');
    state = recallReducer(state, { type: 'approve-success', assetId: 'urn:model:ranking-v2' });
    state = recallReducer(state, { type: 'approve-success', assetId: 'urn:model:relevance-v4' });
    state = recallReducer(state, {
      type: 'writeback-success',
      writebackRef: 'fixture:closure-writeback',
    });
    state = recallReducer(state, { type: 'receipt-issued', receipt: receipt('receipt') });
    state = recallReducer(state, { type: 'verification-start', requestId: 1 });
    state = recallReducer(state, { type: 'verification', requestId: 1, result: 'match' });
    state = recallReducer(state, { type: 'verification-start', requestId: 2 });
    state = recallReducer(state, { type: 'verification', requestId: 2, result: 'mismatch' });

    expect(state.auditEvents.map((event) => event.label)).toEqual([
      'Fixture case opened', 'Approved ranking-v2', 'Approved relevance-v4',
      'Fixture writeback recorded', 'Closure receipt issued', 'Trusted digest match', 'Planted mismatch detected',
    ]);
  });

  it('records the server-issued ref and leaves close and verification failures recoverable', () => {
    let state = initialJourneyState('urn:model:ranking-v2');
    state = recallReducer(state, {
      type: 'writeback-success',
      writebackRef: 'fixture:closure-writeback',
    });
    state = recallReducer(state, { type: 'operation-start', operation: 'close' });
    state = recallReducer(state, { type: 'close-failure', message: 'Close unavailable' });
    state = recallReducer(state, { type: 'verification-start', requestId: 1 });
    state = recallReducer(state, { type: 'verification', requestId: 1, result: 'unavailable', message: 'Verify unavailable' });

    expect(state.writebackRef).toBe('fixture:closure-writeback');
    expect(state.close).toBe('open');
    expect(state.closeError).toBe('Close unavailable');
    expect(state.verification).toBe('unavailable');
    expect(state.verifyError).toBe('Verify unavailable');
  });

});

function receipt(digest: string) {
  return { payload: { caseId: 'fixture' }, digest };
}
