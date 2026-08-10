import RecallConsole from './recall-console';
import type { RecallSnapshot } from './recall-types';

const fixtureSnapshot: RecallSnapshot = {
  caseId: 'case:fixture:license-revoked:v1',
  evidenceIdentity: 'fixture:license-revoked:v1',
  trigger: 'LICENSE_REVOKED',
  lineage: [
    {
      id: 'urn:dataset:training-corpus',
      label: 'training-corpus',
      type: 'dataset',
    },
    {
      id: 'urn:feature:relevance-signals',
      label: 'relevance-signals',
      type: 'feature',
    },
    {
      id: 'urn:model:ranking-v2',
      label: 'ranking-v2',
      type: 'model',
    },
    {
      id: 'urn:model:relevance-v4',
      label: 'relevance-v4',
      type: 'model',
    },
    {
      id: 'urn:deployment:recommendation-api',
      label: 'recommendation-api',
      type: 'deployment',
    },
  ],
};

export default function Page(): React.JSX.Element {
  return <RecallConsole snapshot={fixtureSnapshot} />;
}
