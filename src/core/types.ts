export type TriggerType = 'LICENSE_REVOKED' | 'ERASURE_REQUESTED' | 'CRITICAL_CORRECTION';
export type NodeType = 'dataset' | 'feature' | 'model' | 'deployment';
export type Disposition =
  | 'exclude_future_training'
  | 'retrain'
  | 'unlearn'
  | 'retire'
  | 'lawful_exemption';
export type CaseStatus = 'open' | 'closed';
export type EvidenceMode = 'fixture' | 'live';

export interface RecallEvent {
  id: string;
  trigger: TriggerType;
  sourceUrn: string;
  evidence: Readonly<Record<string, string>>;
  actor: string;
  occurredAt: string;
}

export interface NodeUncertainty {
  id: string;
  description: string;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  owner?: string;
  governance?: Readonly<Record<string, string>>;
  uncertainty?: NodeUncertainty;
}

export interface LineageEdge {
  from: string;
  to: string;
}

export interface NormalizedGraph {
  nodes: readonly GraphNode[];
  edges: readonly LineageEdge[];
}

export interface Approval {
  assetId: string;
  disposition: Disposition;
  approver: string;
  approvedAt: string;
  revisionDigest: string;
}

export interface RecallDecision {
  assetId: string;
  proposedDisposition?: Disposition;
  approval?: Approval;
}

export interface UncertaintyResolution {
  uncertaintyId: string;
  resolvedBy: string;
  resolvedAt: string;
  note: string;
}

export interface WritebackRefs {
  required: readonly string[];
  successful: readonly string[];
}

export interface RecallCase {
  id: string;
  event: RecallEvent;
  graph: NormalizedGraph;
  mode: EvidenceMode;
  evidenceIdentity: string;
  status: CaseStatus;
  revisionDigest: string;
  decisions: readonly RecallDecision[];
  uncertaintyResolutions: readonly UncertaintyResolution[];
  writebackRefs: WritebackRefs;
}

export interface ClosureEvaluation {
  closable: boolean;
  blockers: readonly string[];
}

export interface ReceiptPayload {
  caseId: string;
  event: RecallEvent;
  graph: NormalizedGraph;
  evidenceIdentity: string;
  mode: EvidenceMode;
  revisionDigest: string;
  decisions: readonly RecallDecision[];
  uncertaintyResolutions: readonly UncertaintyResolution[];
  writebackRefs: WritebackRefs;
}

export interface IntegrityReceipt {
  payload: ReceiptPayload;
  digest: string;
}
