import { canonicalJson, sha256Canonical } from './canonical.ts';
import { normalizeGraph } from './graph.ts';
import { assertValidReceiptPayload, assertValidReceiptSource, isIntegrityReceiptEnvelope } from './validation.ts';
import type { IntegrityReceipt, RecallCase, ReceiptPayload } from './types.ts';

export { canonicalJson, sha256Canonical };

export interface ReceiptVerification {
  match: boolean;
  disclaimer: string;
}

const INTEGRITY_DISCLAIMER =
  'Integrity/change detection only; not a signature, authenticity, authorship, provenance, or nonrepudiation proof.';

export function createIntegrityReceipt(payload: ReceiptPayload): IntegrityReceipt {
  assertValidReceiptPayload(payload);
  return { payload, digest: sha256Canonical(payload) };
}

export function createReceiptPayload(
  caseState: Pick<RecallCase, 'id' | 'event' | 'graph' | 'evidenceIdentity' | 'mode' | 'revisionDigest' | 'decisions' | 'uncertaintyResolutions' | 'writebackRefs'>,
): ReceiptPayload {
  assertValidReceiptSource(caseState);
  return {
    caseId: caseState.id, event: caseState.event, graph: normalizeGraph(caseState.graph),
    evidenceIdentity: caseState.evidenceIdentity, mode: caseState.mode,
    revisionDigest: caseState.revisionDigest, decisions: caseState.decisions,
    uncertaintyResolutions: caseState.uncertaintyResolutions,
    writebackRefs: caseState.writebackRefs,
  };
}

export function verifyIntegrityReceipt(
  receipt: unknown,
  trustedDigest: unknown,
): ReceiptVerification {
  return {
    match: receiptMatchesTrustedDigest(receipt, trustedDigest),
    disclaimer: INTEGRITY_DISCLAIMER,
  };
}

function receiptMatchesTrustedDigest(receipt: unknown, trustedDigest: unknown): boolean {
  try {
    return isIntegrityReceiptEnvelope(receipt) && typeof trustedDigest === 'string'
      && receipt.digest === trustedDigest && receiptPayloadMatchesTrustedDigest(receipt.payload, trustedDigest);
  } catch {
    return false;
  }
}

function receiptPayloadMatchesTrustedDigest(payload: unknown, trustedDigest: string): boolean {
  assertValidReceiptPayload(payload);
  return sha256Canonical(payload) === trustedDigest;
}
