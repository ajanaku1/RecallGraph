import assert from 'node:assert/strict';
import test from 'node:test';

import { findImpactedAssets, graphValidationErrors, normalizeGraph } from '../../src/core/graph.ts';
import type { NormalizedGraph } from '../../src/core/types.ts';

test('finds models and deployments downstream in stable entity order', () => {
  const graph: NormalizedGraph = {
    nodes: [
      { id: 'urn:dataset:source', type: 'dataset', owner: 'data@example.com' },
      { id: 'urn:model:zeta', type: 'model', owner: 'ml@example.com' },
      { id: 'urn:deployment:alpha', type: 'deployment', owner: 'ops@example.com' },
    ],
    edges: [
      { from: 'urn:dataset:source', to: 'urn:model:zeta' },
      { from: 'urn:dataset:source', to: 'urn:deployment:alpha' },
    ],
  };

  assert.deepEqual(
    findImpactedAssets(graph, 'urn:dataset:source').impacted.map((node) => node.id),
    ['urn:deployment:alpha', 'urn:model:zeta'],
  );
});

test('traversal tolerates cycles, diamonds, duplicate edges, and mixed entity types', () => {
  const graph: NormalizedGraph = {
    nodes: [
      { id: 'source', type: 'dataset', owner: 'data@example.com' },
      { id: 'feature:a', type: 'feature', owner: 'feature@example.com' },
      { id: 'dataset:derived', type: 'dataset', owner: 'data@example.com' },
      { id: 'model:shared', type: 'model' },
      { id: 'deployment:shared', type: 'deployment', owner: 'ops@example.com', uncertainty: { id: 'u-1', description: 'pending' } },
    ],
    edges: [
      { from: 'source', to: 'feature:a' }, { from: 'source', to: 'dataset:derived' },
      { from: 'feature:a', to: 'model:shared' }, { from: 'dataset:derived', to: 'model:shared' },
      { from: 'dataset:derived', to: 'model:shared' }, { from: 'model:shared', to: 'deployment:shared' },
      { from: 'deployment:shared', to: 'source' },
    ],
  };

  const result = findImpactedAssets(graph, 'source');
  assert.deepEqual(result.impacted.map((node) => node.id), ['deployment:shared', 'model:shared']);
  assert.deepEqual(result.blockers.missingOwnerIds, ['model:shared']);
  assert.deepEqual(result.blockers.uncertainties.map((node) => node.uncertainty?.id), ['u-1']);
});

test('collects uncertainty from reachable source and intermediate lineage nodes', () => {
  const graph: NormalizedGraph = {
    nodes: [
      { id: 'source', type: 'dataset', owner: 'data@example.com', uncertainty: { id: 'u-source', description: 'source' } },
      { id: 'feature:intermediate', type: 'feature', owner: 'feature@example.com', uncertainty: { id: 'u-feature', description: 'feature' } },
      { id: 'model:target', type: 'model', owner: 'ml@example.com' },
    ],
    edges: [{ from: 'source', to: 'feature:intermediate' }, { from: 'feature:intermediate', to: 'model:target' }],
  };

  const result = findImpactedAssets(graph, 'source');
  assert.deepEqual(result.impacted.map((node) => node.id), ['model:target']);
  assert.deepEqual(result.blockers.uncertainties.map((node) => node.uncertainty?.id), ['u-feature', 'u-source']);
});

test('normalization rejects blank and duplicate node IDs', () => {
  assert.throws(
    () => normalizeGraph({ nodes: [{ id: ' ', type: 'dataset' }], edges: [] }),
    /blank graph node id/,
  );
  assert.throws(
    () => normalizeGraph({
      nodes: [{ id: 'urn:dataset:source', type: 'dataset' }, { id: 'urn:dataset:source', type: 'feature' }],
      edges: [],
    }),
    /duplicate graph node id/,
  );
});

test('exported graph operations reject invalid schemas before reading accessors', () => {
  const graph = graphFixture();
  let graphReads = 0;
  const accessorGraph = { ...graph };
  Object.defineProperty(accessorGraph, 'nodes', { enumerable: true, get: () => { graphReads += 1; return graph.nodes; } });
  assert.throws(() => normalizeGraph(accessorGraph), /unsupported canonical value/);
  assert.equal(graphReads, 0);
  let nodeReads = 0;
  const accessorNode = { ...graph.nodes[0] };
  Object.defineProperty(accessorNode, 'id', { enumerable: true, get: () => { nodeReads += 1; return graph.nodes[0].id; } });
  assert.throws(() => normalizeGraph({ ...graph, nodes: [accessorNode, graph.nodes[1]] }), /unsupported canonical value/);
  assert.equal(nodeReads, 0);
  let edgeReads = 0;
  const accessorEdge = { ...graph.edges[0] };
  Object.defineProperty(accessorEdge, 'from', { enumerable: true, get: () => { edgeReads += 1; return graph.edges[0].from; } });
  assert.throws(() => findImpactedAssets({ ...graph, edges: [accessorEdge] }, graph.nodes[0].id), /unsupported canonical value/);
  assert.equal(edgeReads, 0);
  const malformed = [
    { ...graph, extra: 'unknown' },
    { ...graph, nodes: [{ ...graph.nodes[0], extra: 'unknown' }, ...graph.nodes.slice(1)] },
    { ...graph, edges: [{ ...graph.edges[0], extra: 'unknown' }, ...graph.edges.slice(1)] },
    { ...graph, nodes: [{ ...graph.nodes[0], type: 'bogus' }, ...graph.nodes.slice(1)] },
    { ...graph, edges: [{ from: graph.nodes[0].id, to: 'missing' }] },
  ];
  for (const value of malformed) assert.throws(() => normalizeGraph(value as NormalizedGraph));
  assert.throws(() => findImpactedAssets(graph, ' '));
});

test('direct graph validation fails closed without invoking accessors', () => {
  const graph = graphFixture();
  let reads = 0;
  const accessorGraph = { ...graph };
  Object.defineProperty(accessorGraph, 'nodes', { enumerable: true, get: () => { reads += 1; return graph.nodes; } });
  assert.deepEqual(graphValidationErrors(accessorGraph), ['invalid graph']);
  assert.equal(reads, 0);
  const cyclic = graphFixture() as NormalizedGraph & { self?: unknown };
  cyclic.self = cyclic;
  assert.deepEqual(graphValidationErrors(cyclic), ['invalid graph']);
});

function graphFixture(): NormalizedGraph {
  return {
    nodes: [
      { id: 'urn:dataset:source', type: 'dataset', owner: 'data@example.com' },
      { id: 'urn:model:target', type: 'model', owner: 'ml@example.com' },
    ],
    edges: [{ from: 'urn:dataset:source', to: 'urn:model:target' }],
  };
}
