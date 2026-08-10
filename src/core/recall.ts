import { ownDataValue, sha256Canonical } from './canonical.ts';
import { findImpactedAssets, normalizeGraph } from './graph.ts';
import {
  assertCanonicalApprovalInput,
  assertValidOpenInput,
  assertCanonicalResolutionInput,
  assertValidRevisionSource,
  isDisposition,
  isNonBlankString,
  isRecord,
  isValidTimestamp,
  validateClosureBoundary,
} from './validation.ts';
import type {
  Approval, ClosureEvaluation, Disposition, RecallCase, RecallDecision, RecallEvent,
  UncertaintyResolution, WritebackRefs, EvidenceMode, NormalizedGraph,
} from './types.ts';

export interface OpenCaseInput {
  id: string;
  event: RecallEvent;
  graph: NormalizedGraph;
  mode: EvidenceMode;
  evidenceIdentity: string;
  writebackRefs: WritebackRefs;
}

export type ApprovalInput = Approval;

export function openRecallCase(input: OpenCaseInput): RecallCase {
  assertValidOpenInput(input);
  const decisions = findImpactedAssets(input.graph, input.event.sourceUrn).impacted.map(emptyDecision);
  const caseState = {
    ...input, status: 'open' as const, decisions, uncertaintyResolutions: [], revisionDigest: '',
  };
  return { ...caseState, revisionDigest: computeRevisionDigest(caseState) };
}

export function computeRevisionDigest(caseState: RecallCase): string {
  assertValidRevisionSource(caseState);
  return sha256Canonical(materialRevisionState(caseState));
}

export function approveDisposition(caseState: RecallCase, input: ApprovalInput): RecallCase {
  const currentDigest = computeRevisionDigest(caseState);
  assertCanonicalApprovalInput(input);
  validateApprovalInput(caseState, input, currentDigest);
  const decisions = caseState.decisions.map((decision) => applyApproval(decision, input));
  return { ...caseState, decisions, revisionDigest: currentDigest };
}

export function resolveUncertainty(
  caseState: RecallCase,
  resolution: UncertaintyResolution,
): RecallCase {
  computeRevisionDigest(caseState);
  assertCanonicalResolutionInput(resolution);
  validateResolution(caseState, resolution);
  const uncertaintyResolutions = [...caseState.uncertaintyResolutions, resolution];
  const updated = { ...caseState, uncertaintyResolutions };
  return { ...updated, revisionDigest: computeRevisionDigest(updated) };
}

export function evaluateClosure(caseState: unknown): ClosureEvaluation {
  try {
    const boundaryBlockers = validateClosureBoundary(caseState);
    if (boundaryBlockers.length > 0) return { closable: false, blockers: boundaryBlockers };
    const evaluation = evaluateValidatedClosure(caseState as RecallCase);
    const blockers = [...new Set([...boundaryBlockers, ...evaluation.blockers])];
    return { closable: blockers.length === 0, blockers };
  } catch {
    return { closable: false, blockers: ['invalid revision material'] };
  }
}

function evaluateValidatedClosure(caseState: RecallCase): ClosureEvaluation {
  const impacted = findImpactedAssets(caseState.graph, caseState.event.sourceUrn);
  const currentDigest = computeRevisionDigest(caseState);
  const blockers = [
    ...revisionBlockers(caseState, currentDigest),
    ...decisionBlockers(caseState, impacted.impacted, currentDigest),
    ...ownerBlockers(impacted.blockers.missingOwnerIds),
    ...uncertaintyBlockers(caseState, impacted.blockers.uncertainties),
    ...writebackBlockers(caseState.writebackRefs),
  ];
  return { closable: blockers.length === 0, blockers };
}

function emptyDecision(asset: { id: string }): RecallDecision {
  return { assetId: asset.id };
}

function materialRevisionState(caseState: RecallCase): object {
  return {
    event: caseState.event, graph: normalizeGraph(caseState.graph), mode: caseState.mode,
    evidenceIdentity: caseState.evidenceIdentity, decisions: caseState.decisions.map(materialDecision),
    uncertaintyResolutions: caseState.uncertaintyResolutions,
  };
}

function materialDecision(decision: RecallDecision): object {
  const proposedDisposition = ownDataValue(decision, 'proposedDisposition');
  if (proposedDisposition === undefined) return { assetId: decision.assetId };
  return { assetId: decision.assetId, proposedDisposition };
}

function validateApprovalInput(caseState: RecallCase, input: ApprovalInput, currentDigest: string): void {
  if (!hasDecision(caseState, input.assetId)) throw new Error('unknown impacted asset');
  const error = approvalValidationError(input, input.assetId, currentDigest);
  if (error) throw new Error(error);
  if (hasCurrentApproval(caseState, input.assetId, currentDigest)) throw new Error('asset already has a current approval');
}

function hasDecision(caseState: RecallCase, assetId: string): boolean {
  return caseState.decisions.some((decision) => decision.assetId === assetId);
}

function hasCurrentApproval(caseState: RecallCase, assetId: string, currentDigest: string): boolean {
  const decision = caseState.decisions.find((item) => item.assetId === assetId);
  return approvalValidationError(decision ? ownDataValue(decision, 'approval') : undefined, assetId, currentDigest) === undefined;
}

function applyApproval(decision: RecallDecision, input: ApprovalInput): RecallDecision {
  return decision.assetId === input.assetId ? { ...decision, approval: { ...input } } : decision;
}

function validateResolution(caseState: RecallCase, resolution: UncertaintyResolution): void {
  if (!hasUncertainty(caseState, resolution.uncertaintyId)) throw new Error('unknown uncertainty');
  if (isResolved(caseState, resolution.uncertaintyId)) throw new Error('uncertainty already resolved');
  const error = resolutionValidationError(resolution, resolution.uncertaintyId);
  if (error) throw new Error(error);
}

function approvalValidationError(approval: unknown, assetId: string, currentDigest: string): string | undefined {
  if (!isRecord(approval)) return 'missing approval';
  if (approval.assetId !== assetId) return 'approval asset does not match decision';
  if (!isDisposition(approval.disposition)) return 'invalid disposition';
  if (!isNonBlankString(approval.approver)) return 'approval requires approver';
  if (!isValidTimestamp(approval.approvedAt)) return 'approval requires valid timestamp';
  return approval.revisionDigest === currentDigest ? undefined : 'stale approval revision digest';
}

function resolutionValidationError(resolution: unknown, uncertaintyId: string): string | undefined {
  if (!isRecord(resolution) || resolution.uncertaintyId !== uncertaintyId) return 'unknown uncertainty';
  if (!isNonBlankString(resolution.resolvedBy)) return 'uncertainty resolution requires resolver';
  if (!isValidTimestamp(resolution.resolvedAt)) return 'uncertainty resolution requires valid timestamp';
  return isNonBlankString(resolution.note) ? undefined : 'uncertainty resolution requires note';
}

function hasUncertainty(caseState: RecallCase, uncertaintyId: string): boolean {
  return caseState.graph.nodes.some((node) => uncertaintyIdFor(node) === uncertaintyId);
}

function isResolved(caseState: RecallCase, uncertaintyId: string): boolean {
  const matches = caseState.uncertaintyResolutions.filter((item) => item.uncertaintyId === uncertaintyId);
  return matches.length === 1 && resolutionValidationError(matches[0], uncertaintyId) === undefined;
}

function revisionBlockers(caseState: RecallCase, currentDigest: string): string[] {
  return caseState.revisionDigest === currentDigest ? [] : ['revision digest mismatch'];
}

function decisionBlockers(caseState: RecallCase, impacted: readonly { id: string }[], currentDigest: string): string[] {
  const assetIds = new Set(impacted.map((asset) => asset.id));
  return [
    ...caseState.decisions.flatMap((decision) => decisionRecordBlocker(decision, assetIds, currentDigest)),
    ...impacted.flatMap((asset) => decisionBlocker(caseState, asset.id, currentDigest)),
  ];
}

function decisionBlocker(caseState: RecallCase, assetId: string, currentDigest: string): string[] {
  const decisions = caseState.decisions.filter((decision) => decision.assetId === assetId);
  if (decisions.length === 0) return [`missing approved disposition: ${assetId}`];
  if (decisions.length !== 1) return [`invalid decision count: ${assetId}`];
  const approval = ownDataValue(decisions[0], 'approval');
  const error = approvalValidationError(approval, assetId, currentDigest);
  if (approval === undefined || error === 'stale approval revision digest') return [`missing approved disposition: ${assetId}`];
  return [];
}

function decisionRecordBlocker(decision: unknown, assetIds: ReadonlySet<string>, currentDigest: string): string[] {
  if (!isRecord(decision) || !isNonBlankString(decision.assetId) || !assetIds.has(decision.assetId)) return ['invalid decision asset'];
  const proposedDisposition = ownDataValue(decision, 'proposedDisposition');
  const approval = ownDataValue(decision, 'approval');
  if (proposedDisposition !== undefined && !isDisposition(proposedDisposition)) return [`invalid decision: ${decision.assetId}`];
  if (approval !== undefined && approvalValidationError(approval, decision.assetId, currentDigest)) return [`invalid approval: ${decision.assetId}`];
  return [];
}

function ownerBlockers(missingOwnerIds: readonly string[]): string[] {
  return missingOwnerIds.map((id) => `missing owner: ${id}`);
}

function uncertaintyBlockers(caseState: RecallCase, nodes: readonly { uncertainty?: { id: string } }[]): string[] {
  const uncertaintyIds = new Set(nodes.flatMap((node) => {
    const uncertaintyId = uncertaintyIdFor(node);
    return uncertaintyId ? [uncertaintyId] : [];
  }));
  return [
    ...caseState.uncertaintyResolutions.flatMap((resolution) => resolutionRecordBlocker(resolution, uncertaintyIds)),
    ...nodes.flatMap((node) => uncertaintyBlocker(caseState, uncertaintyFor(node))),
  ];
}

function uncertaintyBlocker(caseState: RecallCase, uncertainty: { id: string } | undefined): string[] {
  if (!uncertainty || isResolved(caseState, uncertainty.id)) return [];
  return [`unresolved uncertainty: ${uncertainty.id}`];
}

function resolutionRecordBlocker(resolution: unknown, uncertaintyIds: ReadonlySet<string>): string[] {
  if (!isRecord(resolution) || !isNonBlankString(resolution.uncertaintyId) || !uncertaintyIds.has(resolution.uncertaintyId)) return ['invalid uncertainty resolution'];
  return resolutionValidationError(resolution, resolution.uncertaintyId) ? ['invalid uncertainty resolution'] : [];
}

function uncertaintyFor(node: object): { id: string } | undefined {
  const uncertainty = ownDataValue(node, 'uncertainty');
  return isRecord(uncertainty) && isNonBlankString(uncertainty.id) ? { id: uncertainty.id } : undefined;
}

function uncertaintyIdFor(node: object): string | undefined {
  return uncertaintyFor(node)?.id;
}


function writebackBlockers(refs: WritebackRefs): string[] {
  return refs.required.filter((ref) => !refs.successful.includes(ref))
    .map((ref) => `missing successful writeback: ${ref}`);
}
