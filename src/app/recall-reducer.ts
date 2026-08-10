import type { ReceiptEnvelope } from './recall-types';

export type WritebackState = 'idle' | 'ready' | 'writing' | 'failed' | 'complete';
export type CloseState = 'open' | 'confirming' | 'closing' | 'closed';
export type VerificationState = 'pending' | 'match' | 'mismatch' | 'unavailable';

export interface SessionAuditEvent {
  sequence: number;
  timestamp: string;
  label: string;
}

export interface JourneyState {
  approvedAssetIds: readonly string[];
  selectedAssetId: string;
  writeback: WritebackState;
  writebackRef?: string;
  close: CloseState;
  approvalError?: string;
  writebackError?: string;
  closeError?: string;
  verifyError?: string;
  receipt?: ReceiptEnvelope;
  verification?: VerificationState;
  verificationRequestId?: number;
  auditEvents: readonly SessionAuditEvent[];
}

export type JourneyAction =
  | { type: 'inspect'; assetId: string }
  | { type: 'approval-failure'; message: string }
  | { type: 'approve-success'; assetId: string }
  | { type: 'operation-start'; operation: 'writeback' | 'close' }
  | { type: 'writeback-failure'; message: string }
  | { type: 'retry-writeback' }
  | { type: 'writeback-success'; writebackRef: string }
  | { type: 'request-close' }
  | { type: 'cancel-close' }
  | { type: 'close-failure'; message: string }
  | { type: 'receipt-issued'; receipt: ReceiptEnvelope }
  | { type: 'verification-start'; requestId: number }
  | { type: 'verification'; requestId: number; result: Exclude<VerificationState, 'pending'>; message?: string };

type JourneyOperation = Exclude<
  JourneyAction,
  { type: 'inspect' | 'approval-failure' | 'approve-success' | 'operation-start' }
>;

export function initialJourneyState(selectedAssetId: string): JourneyState {
  return {
    approvedAssetIds: [],
    selectedAssetId,
    writeback: 'idle',
    close: 'open',
    auditEvents: [sessionEvent(1, 'Fixture case opened')],
  };
}

export function recallReducer(
  state: JourneyState,
  action: JourneyAction,
): JourneyState {
  if (action.type === 'inspect') return { ...state, selectedAssetId: action.assetId };
  if (action.type === 'approval-failure') return { ...state, approvalError: action.message };
  if (action.type === 'approve-success') return approveModel(state, action.assetId);
  if (action.type === 'operation-start') return startOperation(state, action.operation);
  return reduceJourneyOperation(state, action);
}

function reduceJourneyOperation(
  state: JourneyState,
  action: JourneyOperation,
): JourneyState {
  switch (action.type) {
    case 'writeback-failure':
      return { ...state, writeback: 'failed', writebackError: action.message };
    case 'retry-writeback':
      return { ...state, writeback: 'ready', writebackError: undefined };
    case 'writeback-success':
      return recordWriteback(state, action.writebackRef);
    case 'request-close':
      return { ...state, close: 'confirming', closeError: undefined };
    case 'cancel-close':
      return { ...state, close: 'open' };
    case 'close-failure':
      return { ...state, close: 'open', closeError: action.message };
    case 'receipt-issued':
      return recordReceipt(state, action);
    case 'verification-start':
      return startVerification(state, action.requestId);
    case 'verification':
      return recordVerification(state, action);
  }
}

function approveModel(state: JourneyState, assetId: string): JourneyState {
  if (state.approvedAssetIds.includes(assetId)) return state;
  const approvedAssetIds = [...state.approvedAssetIds, assetId];
  return appendEvent(
    { ...state, approvedAssetIds, approvalError: undefined },
    `Approved ${assetLabel(assetId)}`,
  );
}

function startOperation(
  state: JourneyState,
  operation: 'writeback' | 'close',
): JourneyState {
  if (operation === 'writeback') {
    return { ...state, writeback: 'writing', writebackError: undefined };
  }
  return { ...state, close: 'closing', closeError: undefined };
}

function recordWriteback(state: JourneyState, writebackRef: string): JourneyState {
  return appendEvent(
    { ...state, writeback: 'complete', writebackRef, writebackError: undefined },
    'Fixture writeback recorded',
  );
}

function recordReceipt(
  state: JourneyState,
  action: Extract<JourneyAction, { type: 'receipt-issued' }>,
): JourneyState {
  return appendEvent(
    {
      ...state,
      close: 'closed',
      receipt: action.receipt,
      closeError: undefined,
    },
    'Closure receipt issued',
  );
}

function startVerification(state: JourneyState, requestId: number): JourneyState {
  return {
    ...state,
    verification: 'pending',
    verificationRequestId: requestId,
    verifyError: undefined,
  };
}

function recordVerification(
  state: JourneyState,
  action: Extract<JourneyAction, { type: 'verification' }>,
): JourneyState {
  if (action.requestId !== state.verificationRequestId) return state;
  if (action.result === 'unavailable') {
    return {
      ...state,
      verification: 'unavailable',
      verificationRequestId: undefined,
      verifyError: action.message ?? 'Verification unavailable. Retry the check.',
    };
  }

  const label = action.result === 'match'
    ? 'Trusted digest match'
    : 'Planted mismatch detected';
  return appendEvent(
    {
      ...state,
      verification: action.result,
      verificationRequestId: undefined,
      verifyError: undefined,
    },
    label,
  );
}

function appendEvent(state: JourneyState, label: string): JourneyState {
  return {
    ...state,
    auditEvents: [
      ...state.auditEvents,
      sessionEvent(state.auditEvents.length + 1, label),
    ],
  };
}

function assetLabel(assetId: string): string {
  return assetId.replace('urn:model:', '');
}

function sessionEvent(sequence: number, label: string): SessionAuditEvent {
  return {
    sequence,
    timestamp: `00:${String(sequence - 1).padStart(2, '0')}`,
    label,
  };
}
