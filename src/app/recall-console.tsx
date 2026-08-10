'use client';

import { useEffect, useReducer, useRef } from 'react';
import { JourneyStatus } from './journey-status';
import type { JourneyViewState } from './journey-status';
import { initialJourneyState, recallReducer } from './recall-reducer';
import type {
  JourneyAction,
  JourneyState,
  SessionAuditEvent,
} from './recall-reducer';
import type { LineageNode, RecallSnapshot } from './recall-types';
import { useRecallCommands } from './use-recall-commands';
import type { RecallCommands } from './use-recall-commands';

interface RecallConsoleProps {
  snapshot: RecallSnapshot;
  viewState?: JourneyViewState;
}

const modelIds = ['urn:model:ranking-v2', 'urn:model:relevance-v4'];

interface ConsoleView {
  snapshot: RecallSnapshot;
  state: JourneyState;
  commands: RecallCommands;
  dispatch: React.Dispatch<JourneyAction>;
}

export default function RecallConsole({
  snapshot,
  viewState = 'ready',
}: RecallConsoleProps): React.JSX.Element {
  const [state, dispatch] = useReducer(
    recallReducer,
    snapshot.lineage[0]?.id ?? '',
    initialJourneyState,
  );
  const commands = useRecallCommands(state, dispatch);
  const unresolvedModels = modelIds.filter(
    (id) => !state.approvedAssetIds.includes(id),
  );

  if (viewState !== 'ready') {
    return <JourneyStatus state={viewState} retry={retryPage} />;
  }

  return (
    <ReadyConsole
      view={{ snapshot, state, commands, dispatch }}
      unresolvedModels={unresolvedModels.length}
    />
  );
}

function ReadyConsole({
  view,
  unresolvedModels,
}: {
  view: ConsoleView;
  unresolvedModels: number;
}): React.JSX.Element {
  return (
    <main className="recall-console" data-testid="recall-console">
      <Navigation />
      <CaseHeader snapshot={view.snapshot} />
      <ClosureSpine state={view.state} />
      <CaseWorkspace view={view} unresolvedModels={unresolvedModels} />
      <AuditTimeline events={view.state.auditEvents} />
      <ReceiptArea state={view.state} commands={view.commands} />
      <IntegrityDisclaimer />
    </main>
  );
}

function CaseWorkspace({
  view,
  unresolvedModels,
}: {
  view: ConsoleView;
  unresolvedModels: number;
}): React.JSX.Element {
  const selected = selectedNode(view.snapshot, view.state.selectedAssetId);
  return (
    <section className="case-layout">
      <EvidenceGraph
        snapshot={view.snapshot}
        selectedId={view.state.selectedAssetId}
        inspect={(assetId) => view.dispatch({ type: 'inspect', assetId })}
      />
      <NodeInspector node={selected} />
      <DecisionRail rail={{ ...view, unresolvedModels }} />
    </section>
  );
}

function ReceiptArea({
  state,
  commands,
}: {
  state: JourneyState;
  commands: RecallCommands;
}): React.JSX.Element | null {
  if (!state.receipt) return null;
  return (
    <ReceiptWorkspace
      workspace={{
        receipt: state.receipt,
        verification: state.verification,
        verifyError: state.verifyError,
        verify: commands.verify,
      }}
    />
  );
}

function IntegrityDisclaimer(): React.JSX.Element {
  return (
    <footer>
      Integrity/change detection only; not a signature, authenticity,
      authorship, provenance, or nonrepudiation proof.
    </footer>
  );
}

function selectedNode(
  snapshot: RecallSnapshot,
  selectedAssetId: string,
): LineageNode | undefined {
  return snapshot.lineage.find((node) => node.id === selectedAssetId)
    ?? snapshot.lineage[0];
}

function Navigation(): React.JSX.Element {
  return (
    <nav className="nav-rail" aria-label="Recall command navigation">
      <img src="/logo.svg" alt="RecallGraph" />
      <span>CASE</span>
      <span>LOG</span>
    </nav>
  );
}

function CaseHeader({ snapshot }: { snapshot: RecallSnapshot }): React.JSX.Element {
  return (
    <header className="case-header">
      <p className="eyebrow">FIXTURE SNAPSHOT — LIVE MODE UNAVAILABLE</p>
      <div>
        <h1>
          RecallGraph <span>Recall Command</span>
        </h1>
        <p>
          {snapshot.trigger} / {snapshot.evidenceIdentity}
        </p>
      </div>
      <p className="adapter-note">Phase 3 DataHub adapter is not connected.</p>
    </header>
  );
}

function ClosureSpine({ state }: { state: JourneyState }): React.JSX.Element {
  const approved = state.approvedAssetIds.length === modelIds.length;

  return (
    <section className="closure-spine" aria-label="Closure progress">
      <span className="complete">trace</span>
      <i className={approved ? 'complete' : ''} />
      <span className={approved ? 'complete' : ''}>approvals</span>
      <i className={state.writeback === 'complete' ? 'complete' : ''} />
      <span className={state.writeback === 'complete' ? 'complete' : ''}>
        writeback
      </span>
      <i className={state.close === 'closed' ? 'complete' : ''} />
      <span className={state.close === 'closed' ? 'complete' : ''}>close</span>
    </section>
  );
}

interface EvidenceGraphProps {
  snapshot: RecallSnapshot;
  selectedId: string;
  inspect: (assetId: string) => void;
}

function EvidenceGraph({ snapshot, selectedId, inspect }: EvidenceGraphProps): React.JSX.Element {
  return (
    <section className="graph-room" aria-labelledby="lineage-heading">
      <p className="eyebrow">EVIDENCE ROOM</p>
      <h2 id="lineage-heading">Recorded lineage</h2>
      <GraphEdges />
      <ol
        className="lineage-list"
        aria-label="Ordered lineage"
        data-mobile-stepper="true"
      >
        {snapshot.lineage.map((node) => (
          <LineageButton
            key={node.id}
            node={node}
            selectedId={selectedId}
            inspect={inspect}
          />
        ))}
      </ol>
      <p className="graph-note">
        5 recorded entities · 4 directed lineage edges · fixture snapshot.
      </p>
    </section>
  );
}

function GraphEdges(): React.JSX.Element {
  return (
    <svg
      className="graph-edges"
      aria-label="Lineage edge connections"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <path d="M13 35 L32 58 L57 20 L87 44" />
      <path d="M32 58 L57 72" />
    </svg>
  );
}

interface LineageButtonProps {
  node: LineageNode;
  selectedId: string;
  inspect: (assetId: string) => void;
}

function LineageButton({
  node,
  selectedId,
  inspect,
}: LineageButtonProps): React.JSX.Element {
  const selected = node.id === selectedId;

  return (
    <li>
      <button
        className={selected ? 'node selected' : 'node'}
        onClick={() => inspect(node.id)}
        aria-pressed={selected}
      >
        <small>{node.type}</small>
        {node.label}
      </button>
    </li>
  );
}

function NodeInspector({
  node,
}: {
  node: LineageNode | undefined;
}): React.JSX.Element {
  return (
    <aside className="node-inspector" aria-live="polite" key={node?.id}>
      <p className="eyebrow">NODE INSPECTOR</p>
      <h2>{node?.label ?? 'No recorded node'}</h2>
      <p>{node?.type ?? 'unknown'} · fixture lineage record</p>
      <p>
        Source: training-corpus → relevance-signals → model evidence →
        recommendation-api.
      </p>
    </aside>
  );
}

interface DecisionRailProps {
  rail: {
    state: JourneyState;
    commands: RecallCommands;
    unresolvedModels: number;
    dispatch: React.Dispatch<JourneyAction>;
  };
}

function DecisionRail({ rail }: DecisionRailProps): React.JSX.Element {
  return (
    <aside className="decision-rail" aria-label="Closure decisions">
      <DecisionHeading unresolvedModels={rail.unresolvedModels} />
      <ApprovalList rail={rail} />
      <DecisionActions rail={rail} />
    </aside>
  );
}

function DecisionHeading({
  unresolvedModels,
}: {
  unresolvedModels: number;
}): React.JSX.Element {
  return (
    <>
      <p className="eyebrow">CLOSURE RAIL</p>
      <h2>Human decisions</h2>
      <p>
        3 impacted descendants · {unresolvedModels} unresolved model decisions ·
        deployment preapproved: retire.
      </p>
    </>
  );
}

function ApprovalList({ rail }: DecisionRailProps): React.JSX.Element {
  const { commands, state } = rail;
  return (
    <>
      {modelIds.map((assetId) => (
        <ApprovalControl
          key={assetId}
          decision={{
            assetId,
            approved: state.approvedAssetIds.includes(assetId),
            disabled: commands.isLoading,
            approve: commands.approve,
          }}
        />
      ))}
      {state.approvalError && <ApprovalFailure message={state.approvalError} />}
    </>
  );
}

function DecisionActions({ rail }: DecisionRailProps): React.JSX.Element {
  const { commands, dispatch, state, unresolvedModels } = rail;
  const writebackEnabled = unresolvedModels === 0;
  const closeEnabled = writebackEnabled && state.writeback === 'complete';
  return (
    <>
      <WritebackControl
        control={{
          state: state.writeback,
          enabled: writebackEnabled,
          error: state.writebackError,
          writeback: commands.writeback,
        }}
      />
      <CloseControl
        control={{
          closeState: state.close,
          enabled: closeEnabled,
          request: () => dispatch({ type: 'request-close' }),
          cancel: () => dispatch({ type: 'cancel-close' }),
          close: commands.close,
          error: state.closeError,
        }}
      />
    </>
  );
}

function ApprovalFailure({ message }: { message: string }): React.JSX.Element {
  return <p className="failure" role="alert">{message}</p>;
}

interface ApprovalControlProps {
  decision: {
    assetId: string;
    approved: boolean;
    disabled: boolean;
    approve: (assetId: string) => Promise<void>;
  };
}

function ApprovalControl({
  decision,
}: ApprovalControlProps): React.JSX.Element {
  const label = decision.assetId.replace('urn:model:', '');

  return (
    <div className="decision">
      <span>{label}</span>
      {decision.approved ? (
        <strong>approved</strong>
      ) : (
        <button
          className="secondary-action"
          disabled={decision.disabled}
          onClick={() => void decision.approve(decision.assetId)}
        >
          Approve {label}
        </button>
      )}
    </div>
  );
}

interface WritebackControlProps {
  control: {
    state: string;
    enabled: boolean;
    error?: string;
    writeback: (retry: boolean) => Promise<void>;
  };
}

function WritebackControl({
  control,
}: WritebackControlProps): React.JSX.Element {
  if (control.state === 'complete') {
    return <p className="success">✓ Fixture writeback recorded.</p>;
  }

  if (control.state === 'failed') {
    return (
      <div className="failure" role="alert">
        {control.error}
        <button onClick={() => void control.writeback(true)}>
          Retry writeback
        </button>
      </div>
    );
  }

  return (
    <button
      className="primary-action"
      disabled={!control.enabled || control.state === 'writing'}
      onClick={() => void control.writeback(false)}
    >
      Record fixture writeback
    </button>
  );
}

interface CloseControlProps {
  control: {
    closeState: string;
    enabled: boolean;
    request: () => void;
    cancel: () => void;
    close: () => Promise<void>;
    error?: string;
  };
}

function CloseControl({ control }: CloseControlProps): React.JSX.Element {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingRef = useRef(false);
  useEffect(
    () => focusDialogControl(control.closeState, triggerRef, wasConfirmingRef),
    [control.closeState],
  );
  if (control.closeState === 'closed') return <ClosedCase />;
  if (control.closeState === 'confirming') return <ConfirmationModal modal={{ control }} />;
  return <CloseTrigger control={control} triggerRef={triggerRef} />;
}

function ClosedCase(): React.JSX.Element {
  return <p className="success">✓ Case closed and receipt issued.</p>;
}

function CloseTrigger({
  control,
  triggerRef,
}: {
  control: CloseControlProps['control'];
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}): React.JSX.Element {
  return (
    <>
      {control.error && <p className="failure" role="alert">{control.error}</p>}
      <button
        ref={triggerRef}
        className="primary-action"
        disabled={!control.enabled || control.closeState === 'closing'}
        onClick={control.request}
      >
        Close case
      </button>
    </>
  );
}

function focusDialogControl(
  closeState: string,
  triggerRef: React.RefObject<HTMLButtonElement | null>,
  wasConfirmingRef: React.MutableRefObject<boolean>,
): void {
  if (closeState === 'confirming') {
    wasConfirmingRef.current = true;
  } else if (wasConfirmingRef.current) {
    wasConfirmingRef.current = false;
    triggerRef.current?.focus();
  }
}

interface ConfirmationModalProps {
  modal: { control: CloseControlProps['control'] };
}

function ConfirmationModal({ modal }: ConfirmationModalProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { control } = modal;
  useEffect(() => openDialog(dialogRef.current, cancelRef.current), []);
  return (
    <dialog
      ref={dialogRef}
      className="confirmation"
      aria-modal="true"
      aria-label="Confirm guarded fixture closure"
      onCancel={(event) => cancelDialog(event, control.cancel)}
      onKeyDown={(event) => escapeDialog(event, control.cancel)}
      onClick={(event) => dismissBackdrop(event, control.cancel)}
    >
      <ConfirmationActions control={control} cancelRef={cancelRef} />
    </dialog>
  );
}

function ConfirmationActions({
  control,
  cancelRef,
}: {
  control: CloseControlProps['control'];
  cancelRef: React.RefObject<HTMLButtonElement | null>;
}): React.JSX.Element {
  return (
    <>
      <p>Confirm guarded fixture closure?</p>
      <button onClick={() => void control.close()}>Issue closure receipt</button>
      <button ref={cancelRef} autoFocus className="quiet" onClick={control.cancel}>
        Cancel
      </button>
    </>
  );
}

function cancelDialog(event: React.SyntheticEvent, dismiss: () => void): void {
  event.preventDefault();
  dismiss();
}

function escapeDialog(
  event: React.KeyboardEvent<HTMLDialogElement>,
  dismiss: () => void,
): void {
  if (event.key === 'Escape') dismiss();
}

function dismissBackdrop(
  event: React.MouseEvent<HTMLDialogElement>,
  dismiss: () => void,
): void {
  if (event.target === event.currentTarget) dismiss();
}

function openDialog(
  dialog: HTMLDialogElement | null,
  cancel: HTMLButtonElement | null,
): void {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') {
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute('open', '');
    }
  } else {
    dialog.setAttribute('open', '');
  }
  cancel?.focus();
}

function AuditTimeline({
  events,
}: {
  events: readonly SessionAuditEvent[];
}): React.JSX.Element {
  return (
    <section className="audit-timeline" aria-label="Audit timeline">
      <p className="eyebrow">AUDIT TIMELINE · FIXTURE / SESSION ONLY</p>
      <ol aria-label="Fixture session audit">
        {events.map((event) => (
          <li key={event.sequence}>
            <span>S{String(event.sequence).padStart(2, '0')}</span>
            <time>{event.timestamp}</time>
            <strong>{event.label}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface ReceiptWorkspaceProps {
  workspace: {
    receipt: { payload: unknown; digest: string };
    verification?: 'pending' | 'match' | 'mismatch' | 'unavailable';
    verifyError?: string;
    verify: (plantedMismatch: boolean) => Promise<void>;
  };
}

function ReceiptWorkspace({ workspace }: ReceiptWorkspaceProps): React.JSX.Element {
  const { receipt, verification, verify, verifyError } = workspace;
  return (
    <section className="receipt-workspace" aria-label="Receipt workspace">
      <p className="eyebrow">RECEIPT WORKSPACE</p>
      <code>{receipt.digest}</code>
      <button disabled={verification === 'pending'} onClick={() => void verify(false)}>Verify trusted match</button>
      <button disabled={verification === 'pending'} className="quiet" onClick={() => void verify(true)}>
        Plant mismatch evidence
      </button>
      <VerificationMessage verification={verification} error={verifyError} />
    </section>
  );
}

function VerificationMessage({
  verification,
  error,
}: {
  verification?: 'pending' | 'match' | 'mismatch' | 'unavailable';
  error?: string;
}): React.JSX.Element | null {
  if (!verification) return null;
  if (verification === 'pending') return <p role="status">Verifying fixture receipt.</p>;
  if (verification === 'unavailable') {
    return <p className="failure" role="alert">{error}</p>;
  }
  return (
    <p className={verification === 'match' ? 'success' : 'failure'}>
      {verification === 'match'
        ? 'Trusted digest match.'
        : 'Planted mismatch detected.'}
    </p>
  );
}

function retryPage(): void {
  window.location.reload();
}
