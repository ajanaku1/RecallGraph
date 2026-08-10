import { NextResponse } from 'next/server';
import { createLicenseRevokedFixtureCase } from '../../../catalog/fixture-cases';
import { approveDisposition, evaluateClosure } from '../../../core/recall';
import {
  createIntegrityReceipt,
  createReceiptPayload,
  verifyIntegrityReceipt,
} from '../../../core/receipt';
import type { RecallCase } from '../../../core/types';

const modelIds = ['urn:model:ranking-v2', 'urn:model:relevance-v4'];
const fixtureWritebackRef = 'fixture:closure-writeback';
const trustedFixtureReceipt = createIntegrityReceipt(
  createReceiptPayload(closedFixtureCase(fixtureWritebackRef)),
);

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => undefined);

  if (!isObject(body) || typeof body.command !== 'string') {
    return response({ error: 'Malformed fixture command.' }, 400);
  }

  if (body.command === 'approve') {
    return approve(body);
  }

  if (body.command === 'writeback') {
    return writeback(body);
  }

  if (body.command === 'close') {
    return close(body);
  }

  if (body.command === 'verify') {
    return verify(body);
  }

  return response({ error: 'Unknown fixture command.' }, 400);
}

function approve(body: Record<string, unknown>): NextResponse {
  if (typeof body.assetId === 'string' && modelIds.includes(body.assetId)) {
    return response({ approved: body.assetId });
  }

  return response(
    { error: 'Only the two fixture model decisions require human approval.' },
    400,
  );
}

function writeback(body: Record<string, unknown>): NextResponse {
  if (!hasAllModelApprovals(body.approvedAssetIds)) {
    return response({ error: 'Both human model approvals are required.' }, 409);
  }

  if (body.testFailure === true && body.retry !== true) {
    return response(
      { error: 'Recorded fixture writeback failed. Retry to continue.' },
      503,
    );
  }

  return response({ writeback: fixtureWritebackRef });
}

function close(body: Record<string, unknown>): NextResponse {
  if (!hasAllModelApprovals(body.approvedAssetIds)) {
    return response({ error: 'Both human model approvals are required.' }, 409);
  }

  if (body.writebackRef !== fixtureWritebackRef) {
    return response({ error: 'The server-issued fixture writeback reference is required.' }, 409);
  }

  const caseState = closedFixtureCase(body.writebackRef);
  const evaluation = evaluateClosure(caseState);

  if (!evaluation.closable) {
    return response({ error: evaluation.blockers.join('; ') }, 409);
  }

  return response({ receipt: createIntegrityReceipt(createReceiptPayload(caseState)) });
}

function verify(body: Record<string, unknown>): NextResponse {
  if (!hasReceiptEnvelope(body.receipt)) {
    return response({ error: 'A complete fixture receipt is required.' }, 400);
  }

  const verification = verifyIntegrityReceipt(body.receipt, trustedFixtureReceipt.digest);

  return response({
    match: verification.match,
    disclaimer: verification.disclaimer,
  });
}

function closedFixtureCase(writebackRef: string): RecallCase {
  const opened = createLicenseRevokedFixtureCase().caseState;
  const withRankingApproval = approveFixture(opened, modelIds[0], 'retrain');
  const withRelevanceApproval = approveFixture(
    withRankingApproval,
    modelIds[1],
    'unlearn',
  );
  const writebackRefs = {
    ...withRelevanceApproval.writebackRefs,
    successful: [writebackRef],
  };

  return { ...withRelevanceApproval, status: 'closed', writebackRefs };
}

function approveFixture(
  caseState: RecallCase,
  assetId: string,
  disposition: 'exclude_future_training' | 'retrain' | 'unlearn',
): RecallCase {
  return approveDisposition(caseState, {
    assetId,
    disposition,
    approver: 'fixture.human@example.com',
    approvedAt: '2026-08-09T10:06:00.000Z',
    revisionDigest: caseState.revisionDigest,
  });
}

function hasAllModelApprovals(value: unknown): boolean {
  return Array.isArray(value) && modelIds.every((id) => value.includes(id));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasReceiptEnvelope(value: unknown): boolean {
  return isObject(value) && !Array.isArray(value)
    && Object.keys(value).length === 2
    && Object.hasOwn(value, 'payload') && Object.hasOwn(value, 'digest');
}

function response(body: object, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}
