import { assertCanonicalValue, canonicalJson, isCanonicalValue, ownDataValue } from './canonical.ts';
import { findImpactedAssets, graphValidationErrors, normalizeGraph } from './graph.ts';
import type { Disposition, NormalizedGraph, TriggerType } from './types.ts';

const INVALID_RECALL_DATA = 'invalid recall data';
const TRIGGER_TYPES = ['LICENSE_REVOKED', 'ERASURE_REQUESTED', 'CRITICAL_CORRECTION'];
const DISPOSITIONS = ['exclude_future_training', 'retrain', 'unlearn', 'retire', 'lawful_exemption'];
const CASE_KEYS = ['id', 'event', 'graph', 'mode', 'evidenceIdentity', 'status', 'revisionDigest', 'decisions', 'uncertaintyResolutions', 'writebackRefs'];
const RECEIPT_SOURCE_KEYS = ['id', 'event', 'graph', 'mode', 'evidenceIdentity', 'revisionDigest', 'decisions', 'uncertaintyResolutions', 'writebackRefs'];
const RECEIPT_KEYS = ['caseId', 'event', 'graph', 'evidenceIdentity', 'mode', 'revisionDigest', 'decisions', 'uncertaintyResolutions', 'writebackRefs'];
const EVENT_KEYS = ['id', 'trigger', 'sourceUrn', 'evidence', 'actor', 'occurredAt'];
const DECISION_KEYS = ['assetId', 'proposedDisposition', 'approval'];
const APPROVAL_KEYS = ['assetId', 'disposition', 'approver', 'approvedAt', 'revisionDigest'];
const RESOLUTION_KEYS = ['uncertaintyId', 'resolvedBy', 'resolvedAt', 'note'];
const WRITEBACK_KEYS = ['required', 'successful'];
const OPEN_INPUT_KEYS = ['id', 'event', 'graph', 'mode', 'evidenceIdentity', 'writebackRefs'];
const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
type SemanticValidator = (value: unknown) => readonly string[];

export function validateClosureBoundary(caseState: unknown): readonly string[] {
  if (!isCanonicalValue(caseState)) return ['invalid revision material'];
  if (!isRecord(caseState)) return ['invalid case envelope'];
  const blockers = validateRevisionSource(caseState);
  if (!isNonBlankString(caseState.revisionDigest)) blockers.push('invalid revision digest');
  if (!isRecordArray(caseState.decisions)) blockers.push('invalid decisions');
  if (!isRecordArray(caseState.uncertaintyResolutions)) blockers.push('invalid uncertainty resolutions');
  return blockers;
}

export function assertValidRevisionSource(caseState: unknown): void {
  assertValidCanonicalSource(caseState, validateRevisionSource);
}

export function assertValidOpenInput(input: unknown): void {
  assertCanonicalValue(input);
  const blockers = validateOpenInput(input);
  if (blockers.includes('invalid event timestamp')) throw new Error('invalid event timestamp');
  assertNoSemanticBlockers(blockers);
}

export function assertValidApprovalInput(input: unknown): void {
  assertValidCanonicalSource(input, validateApprovalInput);
}

export function assertCanonicalApprovalInput(input: unknown): void {
  assertCanonicalExactRecord(input, APPROVAL_KEYS);
}

export function assertValidResolutionInput(input: unknown): void {
  assertValidCanonicalSource(input, validateResolutionInput);
}

export function assertCanonicalResolutionInput(input: unknown): void {
  assertCanonicalExactRecord(input, RESOLUTION_KEYS);
}

export function assertValidReceiptPayload(payload: unknown): void {
  assertValidCanonicalSource(payload, validateReceiptPayload);
}

export function assertValidReceiptSource(source: unknown): void {
  assertValidCanonicalSource(source, validateReceiptSource);
}

export function isIntegrityReceiptEnvelope(value: unknown): value is Readonly<Record<string, unknown>> {
  return isCanonicalValue(value) && isRecord(value) && hasExactKeys(value, ['payload', 'digest'])
    && isReceiptDigest(value.digest);
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidTimestamp(value: unknown): value is string {
  if (!isNonBlankString(value)) return false;
  const parts = parseRfc3339(value);
  return parts !== undefined && hasValidDate(parts) && hasValidTime(parts) && hasValidOffset(parts) && Number.isFinite(Date.parse(value));
}

export function isDisposition(value: unknown): value is Disposition {
  return typeof value === 'string' && DISPOSITIONS.includes(value);
}

function validateRevisionSource(caseState: unknown): string[] {
  if (!hasExactKeys(caseState, CASE_KEYS)) return ['invalid case envelope'];
  const source = caseState as Readonly<Record<string, unknown>>;
  return [...validateCaseSourceFields(source), ...validateMaterialFields(source), ...validateRelationships(source)];
}

function validateReceiptPayload(payload: unknown): string[] {
  if (!hasExactKeys(payload, RECEIPT_KEYS)) return ['invalid receipt payload'];
  const source = payload as Readonly<Record<string, unknown>>;
  const identity = isNonBlankString(source.caseId) && isNonBlankString(source.revisionDigest) ? [] : ['invalid receipt payload'];
  return [...identity, ...validateMaterialFields(source), ...validateRelationships(source), ...validateNormalizedPayloadGraph(source.graph)];
}

function validateReceiptSource(source: unknown): string[] {
  if (hasExactKeys(source, CASE_KEYS)) {
    const record = source as Readonly<Record<string, unknown>>;
    return [...validateRevisionSource(source), ...(isNonBlankString(record.revisionDigest) ? [] : ['invalid receipt source'])];
  }
  if (!hasExactKeys(source, RECEIPT_SOURCE_KEYS)) return ['invalid receipt source'];
  const record = source as Readonly<Record<string, unknown>>;
  const identity = isNonBlankString(record.id) && isNonBlankString(record.revisionDigest) ? [] : ['invalid receipt source'];
  return [...identity, ...validateMaterialFields(record), ...validateRelationships(record)];
}

function validateOpenInput(input: unknown): string[] {
  if (!hasExactKeys(input, OPEN_INPUT_KEYS)) return ['invalid open input'];
  const record = input as Readonly<Record<string, unknown>>;
  const identity = isNonBlankString(record.id) ? [] : ['invalid case id'];
  const mode = record.mode === 'fixture' || record.mode === 'live' ? [] : ['invalid case mode'];
  const evidenceIdentity = isNonBlankString(record.evidenceIdentity) ? [] : ['invalid evidence identity'];
  const sourceUrn = isRecord(record.event) && isNonBlankString(record.event.sourceUrn) ? record.event.sourceUrn : undefined;
  return [...identity, ...mode, ...evidenceIdentity, ...validateEvent(record.event), ...validateWritebackRefs(record.writebackRefs), ...graphValidationErrors(record.graph, sourceUrn)];
}

function validateApprovalInput(input: unknown): string[] {
  return isApprovalShape(input) ? [] : ['invalid approval input'];
}

function validateResolutionInput(input: unknown): string[] {
  return isResolutionShape(input) ? [] : ['invalid uncertainty resolution'];
}

function validateCaseSourceFields(caseState: Readonly<Record<string, unknown>>): string[] {
  const blockers: string[] = [];
  if (!isNonBlankString(caseState.id)) blockers.push('invalid case id');
  if (typeof caseState.revisionDigest !== 'string') blockers.push('invalid revision digest');
  if (caseState.status !== 'open' && caseState.status !== 'closed') blockers.push('invalid case status');
  return blockers;
}

function validateMaterialFields(source: Readonly<Record<string, unknown>>): string[] {
  const event = source.event;
  const sourceUrn = isRecord(event) && isNonBlankString(event.sourceUrn) ? event.sourceUrn : undefined;
  const mode = source.mode === 'fixture' || source.mode === 'live';
  return [
    ...(mode ? [] : ['invalid case mode']),
    ...(isNonBlankString(source.evidenceIdentity) ? [] : ['invalid evidence identity']),
    ...validateEvent(event), ...validateWritebackRefs(source.writebackRefs),
    ...graphValidationErrors(source.graph, sourceUrn), ...validateDecisionShapes(source.decisions),
    ...validateResolutionShapes(source.uncertaintyResolutions),
  ];
}

function validateRelationships(source: Readonly<Record<string, unknown>>): string[] {
  const sourceUrn = isRecord(source.event) && isNonBlankString(source.event.sourceUrn) ? source.event.sourceUrn : undefined;
  const ids = collectRelationshipIds(source.graph, sourceUrn);
  if (!ids) return [];
  return [
    ...validateDecisionRelationships(source.decisions, ids.assetIds),
    ...validateResolutionRelationships(source.uncertaintyResolutions, ids.uncertaintyIds),
  ];
}

function collectRelationshipIds(graph: unknown, sourceUrn: string | undefined): RelationshipIds | undefined {
  if (!isRecord(graph) || !sourceUrn) return undefined;
  try {
    const impact = findImpactedAssets(graph as unknown as NormalizedGraph, sourceUrn);
    const assetIds = new Set(impact.impacted.map((node) => node.id));
    const uncertaintyIds = new Set(impact.blockers.uncertainties.flatMap((node) => uncertaintyId(node)));
    return { assetIds, uncertaintyIds };
  } catch {
    return undefined;
  }
}

function uncertaintyId(node: object): string[] {
  const uncertainty = ownDataValue(node, 'uncertainty');
  return isRecord(uncertainty) && isNonBlankString(uncertainty.id) ? [uncertainty.id] : [];
}

function validateDecisionRelationships(decisions: unknown, assetIds: ReadonlySet<string>): string[] {
  if (!Array.isArray(decisions)) return [];
  const blockers: string[] = [];
  const ids = new Set<string>();
  for (const decision of decisions) {
    if (!isRecord(decision) || !isNonBlankString(decision.assetId)) continue;
    if (ids.has(decision.assetId)) blockers.push(`invalid decision count: ${decision.assetId}`);
    else ids.add(decision.assetId);
    if (!assetIds.has(decision.assetId)) blockers.push('invalid decision asset');
  }
  for (const assetId of assetIds) {
    if (!ids.has(assetId)) blockers.push(`missing decision: ${assetId}`);
  }
  return blockers;
}

function validateResolutionRelationships(resolutions: unknown, uncertaintyIds: ReadonlySet<string>): string[] {
  if (!Array.isArray(resolutions)) return [];
  const blockers: string[] = [];
  for (const resolution of resolutions) {
    if (!isRecord(resolution) || !isNonBlankString(resolution.uncertaintyId)) continue;
    if (!uncertaintyIds.has(resolution.uncertaintyId)) blockers.push('invalid uncertainty resolution');
  }
  return blockers;
}

function validateEvent(event: unknown): string[] {
  if (!hasExactKeys(event, EVENT_KEYS)) return ['invalid event'];
  const record = event as Readonly<Record<string, unknown>>;
  const blockers: string[] = [];
  if (!isNonBlankString(record.id)) blockers.push('invalid event id');
  if (!isTriggerType(record.trigger)) blockers.push('invalid event trigger');
  if (!isNonBlankString(record.sourceUrn)) blockers.push('invalid event source');
  if (!isNonBlankString(record.actor)) blockers.push('invalid event actor');
  if (!isValidTimestamp(record.occurredAt)) blockers.push('invalid event timestamp');
  if (!isStringRecord(record.evidence)) blockers.push('invalid event evidence');
  return blockers;
}

function validateWritebackRefs(refs: unknown): string[] {
  if (!hasExactKeys(refs, WRITEBACK_KEYS)) return ['invalid writeback refs'];
  const record = refs as Readonly<Record<string, unknown>>;
  const required = record.required;
  const successful = record.successful;
  if (!isReferenceSet(required, true) || !isReferenceSet(successful, false)) return ['invalid writeback refs'];
  return successful.every((ref) => required.includes(ref)) ? [] : ['invalid writeback refs'];
}

function validateDecisionShapes(decisions: unknown): string[] {
  if (!Array.isArray(decisions)) return ['invalid decisions'];
  return decisions.flatMap((decision) => validateDecisionShape(decision));
}

function validateDecisionShape(decision: unknown): string[] {
  if (!hasAllowedKeys(decision, ['assetId'], DECISION_KEYS)) return ['invalid decision record'];
  const record = decision as Readonly<Record<string, unknown>>;
  if (!isNonBlankString(record.assetId)) return ['invalid decision record'];
  const proposedDisposition = ownDataValue(record, 'proposedDisposition');
  const approval = ownDataValue(record, 'approval');
  if (proposedDisposition !== undefined && !isDisposition(proposedDisposition)) return [`invalid decision: ${record.assetId}`];
  if (approval === undefined) return [];
  if (!isApprovalShape(approval)) return [`invalid approval: ${record.assetId}`];
  return approvalMatchesDecision(approval, record.assetId) ? [] : [`invalid approval: ${record.assetId}`];
}

function approvalMatchesDecision(approval: unknown, assetId: string): boolean {
  return isRecord(approval) && approval.assetId === assetId;
}

function isApprovalShape(approval: unknown): boolean {
  if (!hasExactKeys(approval, APPROVAL_KEYS)) return false;
  const record = approval as Readonly<Record<string, unknown>>;
  return isNonBlankString(record.assetId) && isDisposition(record.disposition)
    && isNonBlankString(record.approver) && isValidTimestamp(record.approvedAt) && isNonBlankString(record.revisionDigest);
}

function validateResolutionShapes(resolutions: unknown): string[] {
  if (!Array.isArray(resolutions)) return ['invalid uncertainty resolutions'];
  const blockers: string[] = [];
  const ids = new Set<string>();
  for (const resolution of resolutions) {
    if (!isResolutionShape(resolution)) appendInvalidResolution(blockers, resolution);
    else if (ids.has(resolution.uncertaintyId)) appendDuplicateResolution(blockers, resolution.uncertaintyId);
    else ids.add(resolution.uncertaintyId);
  }
  return blockers;
}

function isResolutionShape(resolution: unknown): resolution is Readonly<Record<string, unknown>> & { uncertaintyId: string } {
  if (!hasExactKeys(resolution, RESOLUTION_KEYS)) return false;
  const record = resolution as Readonly<Record<string, unknown>>;
  return isNonBlankString(record.uncertaintyId) && isNonBlankString(record.resolvedBy)
    && isValidTimestamp(record.resolvedAt) && isNonBlankString(record.note);
}

function appendInvalidResolution(blockers: string[], resolution: unknown): void {
  blockers.push('invalid uncertainty resolution');
  if (isRecord(resolution) && isNonBlankString(resolution.uncertaintyId)) blockers.push(`unresolved uncertainty: ${resolution.uncertaintyId}`);
}

function appendDuplicateResolution(blockers: string[], uncertaintyId: string): void {
  blockers.push('invalid uncertainty resolution', `unresolved uncertainty: ${uncertaintyId}`);
}

function validateNormalizedPayloadGraph(graph: unknown): string[] {
  if (!isRecord(graph)) return ['invalid receipt payload'];
  try {
    const normalized = normalizeGraph(graph as unknown as NormalizedGraph);
    return canonicalJson(graph) === canonicalJson(normalized) ? [] : ['invalid receipt payload'];
  } catch {
    return ['invalid receipt payload'];
  }
}

function hasExactKeys(value: unknown, keys: readonly string[]): boolean {
  return hasAllowedKeys(value, keys, keys);
}

function hasAllowedKeys(value: unknown, required: readonly string[], allowed: readonly string[]): boolean {
  if (!isRecord(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.every((key) => typeof key === 'string' && allowed.includes(key))
    && required.every((key) => Object.hasOwn(value, key));
}

function assertNoSemanticBlockers(blockers: readonly string[]): void {
  if (blockers.length > 0) throw new Error(INVALID_RECALL_DATA);
}

function assertValidCanonicalSource(value: unknown, validator: SemanticValidator): void {
  assertCanonicalValue(value);
  assertNoSemanticBlockers(validator(value));
}

function assertCanonicalExactRecord(value: unknown, keys: readonly string[]): void {
  assertCanonicalValue(value);
  assertNoSemanticBlockers(hasExactKeys(value, keys) ? [] : ['invalid recall data']);
}

function isTriggerType(value: unknown): value is TriggerType {
  return typeof value === 'string' && TRIGGER_TYPES.includes(value);
}

function isStringRecord(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string');
}

function isReferenceSet(value: unknown, requiresValue: boolean): value is readonly string[] {
  return isCanonicalValue(value) && Array.isArray(value) && (!requiresValue || value.length > 0)
    && value.every(isNonBlankString) && new Set(value).size === value.length;
}

function isReceiptDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isRecordArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isRecord);
}

function parseRfc3339(value: string): TimestampParts | undefined {
  const match = RFC3339.exec(value);
  if (!match) return undefined;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6]), offset: match[7] };
}

function hasValidDate(parts: TimestampParts): boolean {
  return parts.month >= 1 && parts.month <= 12 && parts.day >= 1 && parts.day <= daysInMonth(parts.year, parts.month);
}

function hasValidTime(parts: TimestampParts): boolean {
  return parts.hour >= 0 && parts.hour <= 23 && parts.minute >= 0 && parts.minute <= 59 && parts.second >= 0 && parts.second <= 59;
}

function hasValidOffset(parts: TimestampParts): boolean {
  if (parts.offset === 'Z') return true;
  const [hours, minutes] = parts.offset.slice(1).split(':').map(Number);
  return hours <= 23 && minutes <= 59;
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

interface TimestampParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  offset: string;
}

interface RelationshipIds {
  assetIds: ReadonlySet<string>;
  uncertaintyIds: ReadonlySet<string>;
}
