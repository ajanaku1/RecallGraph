import { assertCanonicalValue, isCanonicalValue, ownDataValue } from './canonical.ts';
import type { GraphNode, LineageEdge, NormalizedGraph } from './types.ts';

const NODE_TYPES = ['dataset', 'feature', 'model', 'deployment'];
const GRAPH_KEYS = ['nodes', 'edges'];
const NODE_KEYS = ['id', 'type', 'owner', 'governance', 'uncertainty'];
const EDGE_KEYS = ['from', 'to'];
const UNCERTAINTY_KEYS = ['id', 'description'];

interface GraphValidationState {
  blockers: string[];
  ids: ReadonlySet<string>;
  datasetIds: ReadonlySet<string>;
}

export interface GraphBlockers {
  missingOwnerIds: readonly string[];
  uncertainties: readonly GraphNode[];
}

export interface ImpactResult {
  impacted: readonly GraphNode[];
  blockers: GraphBlockers;
}

export function findImpactedAssets(graph: NormalizedGraph, sourceUrn: string): ImpactResult {
  assertValidGraph(graph, sourceUrn);
  const normalizedGraph = normalizeGraph(graph);
  const reachableIds = collectReachableIds(normalizedGraph, sourceUrn);
  const impacted = normalizedGraph.nodes.filter((node) => isImpacted(node, reachableIds));
  const stableImpacted = impacted.toSorted(compareNodeIds);
  return { impacted: stableImpacted, blockers: collectGraphBlockers(normalizedGraph, stableImpacted, reachableIds, sourceUrn) };
}

export function normalizeGraph(graph: NormalizedGraph): NormalizedGraph {
  assertValidGraph(graph);
  return { nodes: graph.nodes.toSorted(compareNodeIds), edges: normalizeEdges(graph.edges) };
}

export function graphValidationErrors(graph: unknown, sourceUrn?: string): string[] {
  if (!isCanonicalValue(graph)) return ['invalid graph'];
  return structuralGraphValidationErrors(graph, sourceUrn);
}

function structuralGraphValidationErrors(graph: unknown, sourceUrn?: string): string[] {
  if (!hasExactKeys(graph, GRAPH_KEYS)) return ['invalid graph'];
  const record = graph as Readonly<Record<string, unknown>>;
  if (!Array.isArray(record.nodes) || !Array.isArray(record.edges)) return ['invalid graph'];
  const state = validateNodes(record.nodes);
  const blockers = [...state.blockers, ...validateEdges(record.edges, state.ids)];
  if (sourceUrn !== undefined && !state.datasetIds.has(sourceUrn)) blockers.push('invalid graph source node');
  return blockers;
}

function collectReachableIds(graph: NormalizedGraph, sourceUrn: string): ReadonlySet<string> {
  const downstream = indexDownstream(graph);
  const visited = new Set<string>([sourceUrn]);
  const queue = [sourceUrn];
  for (const current of queue) {
    for (const next of downstream.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  visited.delete(sourceUrn);
  return visited;
}

function indexDownstream(graph: NormalizedGraph): ReadonlyMap<string, readonly string[]> {
  const downstream = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const next = downstream.get(edge.from) ?? [];
    if (!next.includes(edge.to)) next.push(edge.to);
    downstream.set(edge.from, next);
  }
  return downstream;
}

function isImpacted(node: GraphNode, reachableIds: ReadonlySet<string>): boolean {
  return reachableIds.has(node.id) && (node.type === 'model' || node.type === 'deployment');
}

function compareNodeIds(left: GraphNode, right: GraphNode): number {
  return compareStrings(left.id, right.id);
}

function assertValidGraph(graph: unknown, sourceUrn?: string): void {
  assertCanonicalValue(graph);
  if (sourceUrn !== undefined && !isNonBlankString(sourceUrn)) throw new Error('invalid graph source node');
  const blockers = structuralGraphValidationErrors(graph, sourceUrn);
  if (blockers.length > 0) throw new Error(blockers[0]);
}

function validateNodes(nodes: readonly unknown[]): GraphValidationState {
  const blockers: string[] = [];
  const ids = new Set<string>();
  const datasetIds = new Set<string>();
  const uncertaintyIds = new Set<string>();
  for (const node of nodes) {
    validateNode(node, ids, datasetIds, uncertaintyIds, blockers);
  }
  return { blockers, ids, datasetIds };
}

function validateNode(node: unknown, ids: Set<string>, datasetIds: Set<string>, uncertaintyIds: Set<string>, blockers: string[]): void {
  if (!hasAllowedKeys(node, ['id', 'type'], NODE_KEYS)) { blockers.push('invalid graph node'); return; }
  const record = node as Readonly<Record<string, unknown>>;
  if (!isNonBlankString(record.id)) { blockers.push('blank graph node id'); return; }
  if (ids.has(record.id)) blockers.push('duplicate graph node id'); else ids.add(record.id);
  if (!isNodeType(record.type)) blockers.push('invalid graph node type');
  if (record.type === 'dataset') datasetIds.add(record.id);
  const owner = ownDataValue(record, 'owner');
  const governance = ownDataValue(record, 'governance');
  const uncertainty = ownDataValue(record, 'uncertainty');
  if (owner !== undefined && !isNonBlankString(owner)) blockers.push('invalid graph node owner');
  if (governance !== undefined && !isStringRecord(governance)) blockers.push('invalid graph governance');
  if (uncertainty !== undefined) validateUncertainty(uncertainty, uncertaintyIds, blockers);
}

function validateUncertainty(value: unknown, ids: Set<string>, blockers: string[]): void {
  if (!hasExactKeys(value, UNCERTAINTY_KEYS)) { blockers.push('invalid graph uncertainty'); return; }
  const record = value as Readonly<Record<string, unknown>>;
  if (!isNonBlankString(record.id) || !isNonBlankString(record.description)) blockers.push('invalid graph uncertainty');
  else if (ids.has(record.id)) blockers.push('invalid graph uncertainty'); else ids.add(record.id);
}

function validateEdges(edges: readonly unknown[], ids: ReadonlySet<string>): string[] {
  const blockers: string[] = [];
  for (const edge of edges) validateEdge(edge, ids, blockers);
  return blockers;
}

function validateEdge(edge: unknown, ids: ReadonlySet<string>, blockers: string[]): void {
  if (!hasExactKeys(edge, EDGE_KEYS)) { blockers.push('invalid graph edge'); return; }
  const record = edge as Readonly<Record<string, unknown>>;
  if (!isNonBlankString(record.from) || !isNonBlankString(record.to)) blockers.push('invalid graph edge');
  else if (!ids.has(record.from) || !ids.has(record.to)) blockers.push('invalid graph edge endpoint');
}

function normalizeEdges(edges: readonly LineageEdge[]): readonly LineageEdge[] {
  const sorted = edges.toSorted(compareEdges);
  return sorted.filter((edge, index) => index === 0 || !sameEdge(edge, sorted[index - 1]));
}

function compareEdges(left: LineageEdge, right: LineageEdge): number {
  return compareStrings(left.from, right.from) || compareStrings(left.to, right.to);
}

function compareStrings(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function sameEdge(left: LineageEdge, right: LineageEdge): boolean {
  return left.from === right.from && left.to === right.to;
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNodeType(value: unknown): boolean {
  return typeof value === 'string' && NODE_TYPES.includes(value);
}

function isStringRecord(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string');
}

function collectGraphBlockers(
  graph: NormalizedGraph,
  impacted: readonly GraphNode[],
  reachableIds: ReadonlySet<string>,
  sourceUrn: string,
): GraphBlockers {
  return {
    missingOwnerIds: impacted.filter((node) => !ownDataValue(node, 'owner')).map((node) => node.id),
    uncertainties: graph.nodes.filter((node) => hasReachableUncertainty(node, reachableIds, sourceUrn)),
  };
}

function hasReachableUncertainty(node: GraphNode, reachableIds: ReadonlySet<string>, sourceUrn: string): boolean {
  return ownDataValue(node, 'uncertainty') !== undefined && (node.id === sourceUrn || reachableIds.has(node.id));
}
