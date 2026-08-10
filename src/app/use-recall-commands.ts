import { useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { JourneyAction, JourneyState } from './recall-reducer';
import type { CloseResponse } from './recall-types';

interface VerifyResponse {
  match: boolean;
  disclaimer: string;
}

interface WritebackResponse {
  writeback: string;
}

type TransportResult = { ok: true; payload: unknown } | { ok: false; error: string };

const REQUEST_TIMEOUT_MS = 5_000;

export interface RecallCommands {
  isLoading: boolean;
  approve: (assetId: string) => Promise<void>;
  writeback: (retry: boolean) => Promise<void>;
  close: () => Promise<void>;
  verify: (plantedMismatch: boolean) => Promise<void>;
}

export function useRecallCommands(
  state: JourneyState,
  dispatch: Dispatch<JourneyAction>,
): RecallCommands {
  const [isLoading, setIsLoading] = useState(false);
  const verificationId = useRef(0);
  return {
    isLoading,
    approve: (assetId) => approveCommand(assetId, dispatch, setIsLoading),
    writeback: (retry) => writebackCommand(state, retry, dispatch),
    close: () => closeCommand(state, dispatch),
    verify: (plantedMismatch) => verifyCommand(state, plantedMismatch, dispatch, ++verificationId.current),
  };
}

async function approveCommand(
  assetId: string,
  dispatch: Dispatch<JourneyAction>,
  setIsLoading: Dispatch<SetStateAction<boolean>>,
): Promise<void> {
  setIsLoading(true);
  const result = await postJson({ command: 'approve', assetId });
  setIsLoading(false);
  dispatch(isApprovalResponse(result, assetId)
    ? { type: 'approve-success', assetId }
    : { type: 'approval-failure', message: approvalMessage(responseMessage(result, 'approval')) });
}

async function writebackCommand(
  state: JourneyState,
  retry: boolean,
  dispatch: Dispatch<JourneyAction>,
): Promise<void> {
  dispatch({ type: 'operation-start', operation: 'writeback' });
  const result = await postJson({ command: 'writeback', approvedAssetIds: state.approvedAssetIds, retry });
  dispatch(writebackAction(result));
}

async function closeCommand(
  state: JourneyState,
  dispatch: Dispatch<JourneyAction>,
): Promise<void> {
  dispatch({ type: 'operation-start', operation: 'close' });
  const result = await postJson({
    command: 'close', approvedAssetIds: state.approvedAssetIds, writebackRef: state.writebackRef,
  });
  dispatch(closeAction(result));
}

async function verifyCommand(
  state: JourneyState,
  plantedMismatch: boolean,
  dispatch: Dispatch<JourneyAction>,
  requestId: number,
): Promise<void> {
  if (!state.receipt) return;
  dispatch({ type: 'verification-start', requestId });
  const result = await postJson({
    command: 'verify', receipt: plantedMismatch ? plantMismatch(state.receipt) : state.receipt,
  });
  dispatch(verificationAction(result, requestId));
}

function writebackAction(result: TransportResult): JourneyAction {
  return isWritebackResponse(result)
    ? { type: 'writeback-success', writebackRef: result.payload.writeback }
    : { type: 'writeback-failure', message: responseMessage(result, 'writeback') };
}

function closeAction(result: TransportResult): JourneyAction {
  return isCloseResponse(result)
    ? { type: 'receipt-issued', receipt: result.payload.receipt }
    : { type: 'close-failure', message: responseMessage(result, 'closure') };
}

function verificationAction(result: TransportResult, requestId: number): JourneyAction {
  if (!isVerifyResponse(result)) {
    return verificationFailure(requestId, responseMessage(result, 'verification'));
  }
  return { type: 'verification', requestId, result: result.payload.match ? 'match' : 'mismatch' };
}

function verificationFailure(requestId: number, message: string): JourneyAction {
  return {
    type: 'verification', requestId, result: 'unavailable',
    message: `Verification unavailable: ${message}`,
  };
}

function approvalMessage(error: string): string {
  return `Approval unavailable: ${error}`;
}

function responseMessage(result: TransportResult, operation: string): string {
  return result.ok
    ? `Fixture ${operation} response unavailable. Retry the operation.`
    : result.error;
}

async function postJson(body: object): Promise<TransportResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      fetch('/api/recall', requestOptions(body, controller)),
      timeoutRejection(controller, (value) => { timer = value; }),
    ]);
    if (!response.ok) return { ok: false, error: `Fixture request failed (${response.status}).` };
    return { ok: true, payload: await response.json() };
  } catch (error) {
    return { ok: false, error: requestError(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function requestOptions(body: object, controller: AbortController): RequestInit {
  return {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: controller.signal,
  };
}

function timeoutRejection(
  controller: AbortController,
  setTimer: (timer: ReturnType<typeof setTimeout>) => void,
): Promise<never> {
  return new Promise((_, reject) => {
    setTimer(setTimeout(() => {
      controller.abort();
      reject(new Error('request timed out'));
    }, REQUEST_TIMEOUT_MS));
  });
}

function requestError(error: unknown): string {
  return error instanceof Error && error.message === 'request timed out'
    ? 'Fixture request timed out. Retry the recorded operation.'
    : 'Fixture command unavailable. Retry the recorded operation.';
}

function isApprovalResponse(result: TransportResult, assetId: string): boolean {
  return result.ok && hasExactRecord(result.payload, ['approved']) && result.payload.approved === assetId;
}

function isCloseResponse(result: TransportResult): result is { ok: true; payload: CloseResponse } {
  return result.ok && hasExactRecord(result.payload, ['receipt']) && isReceiptEnvelope(result.payload.receipt);
}

function isVerifyResponse(result: TransportResult): result is { ok: true; payload: VerifyResponse } {
  return result.ok && hasExactRecord(result.payload, ['match', 'disclaimer'])
    && typeof result.payload.match === 'boolean' && typeof result.payload.disclaimer === 'string';
}

function isWritebackResponse(result: TransportResult): result is { ok: true; payload: WritebackResponse } {
  return result.ok && hasExactRecord(result.payload, ['writeback'])
    && typeof result.payload.writeback === 'string';
}

function isReceiptEnvelope(value: unknown): value is CloseResponse['receipt'] {
  return hasExactRecord(value, ['payload', 'digest']) && typeof value.digest === 'string';
}

function hasExactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const names = Object.getOwnPropertyNames(value);
  return Object.getOwnPropertySymbols(value).length === 0 && names.length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function plantMismatch(receipt: CloseResponse['receipt']): CloseResponse['receipt'] {
  return { ...receipt, digest: `${receipt.digest}mismatch` };
}
