export type LineageNodeType = 'dataset' | 'feature' | 'model' | 'deployment';

export interface LineageNode {
  id: string;
  label: string;
  type: LineageNodeType;
}

export interface RecallSnapshot {
  caseId: string;
  evidenceIdentity: string;
  trigger: 'LICENSE_REVOKED';
  lineage: readonly LineageNode[];
}

export interface CloseResponse {
  receipt: ReceiptEnvelope;
}

export interface ReceiptEnvelope {
  payload: unknown;
  digest: string;
}
