import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RecallConsole from '../../src/app/recall-console';

const snapshot = {
  caseId: 'case:fixture:license-revoked:v1',
  evidenceIdentity: 'fixture:license-revoked:v1',
  trigger: 'LICENSE_REVOKED',
  lineage: [
    { id: 'urn:dataset:training-corpus', label: 'training-corpus', type: 'dataset' },
    { id: 'urn:feature:relevance-signals', label: 'relevance-signals', type: 'feature' },
    { id: 'urn:model:ranking-v2', label: 'ranking-v2', type: 'model' },
  ],
} as const;

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fixtureFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { command: string; assetId?: string };
    return body.command === 'approve'
      ? jsonResponse({ approved: body.assetId })
      : jsonResponse({ writeback: 'fixture:closure-writeback' });
  });
}

describe('Recall Console accessibility', () => {
  it('supports keyboard graph inspection and fixture-only truth labels', async () => {
    const user = userEvent.setup();
    render(<RecallConsole snapshot={snapshot} />);
    const node = screen.getByRole('button', { name: /^model ranking-v2$/i });
    node.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: /ranking-v2/i })).toBeVisible();
    expect(screen.getByText(/fixture snapshot — live mode unavailable/i)).toBeVisible();
  });

  it('keeps ordered lineage semantics for mobile and a reduced-motion hook', () => {
    render(<RecallConsole snapshot={snapshot} />);
    expect(screen.getByRole('list', { name: /ordered lineage/i })).toBeVisible();
    expect(screen.getByTestId('recall-console')).toHaveClass('recall-console');
  });

  it.each(['loading', 'error', 'not-found'] as const)('shows %s recovery semantics', (viewState) => {
    render(<RecallConsole snapshot={snapshot} viewState={viewState} />);
    if (viewState === 'loading') expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    else expect(screen.getByRole(viewState === 'error' ? 'alert' : 'status')).toHaveTextContent(/fixture/i);
  });

  it('gates writeback until both model approvals, then uses the normal success path', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', fixtureFetch());
    render(<RecallConsole snapshot={snapshot} />);
    const writeback = screen.getByRole('button', { name: /record fixture writeback/i });
    expect(writeback).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /approve ranking-v2/i }));
    await user.click(screen.getByRole('button', { name: /approve relevance-v4/i }));
    expect(writeback).toBeEnabled();
    await user.click(writeback);
    expect((await screen.findAllByText(/writeback recorded/i))[0]).toBeVisible();
  });

  it('keeps approval labels on explicit high-contrast secondary controls', () => {
    render(<RecallConsole snapshot={snapshot} />);
    const approval = screen.getByRole('button', { name: /approve ranking-v2/i });
    expect(approval).toHaveClass('secondary-action');
    expect(approval).toHaveTextContent('Approve ranking-v2');
  });

  it('renders the fixture session audit ledger as an ordered list', () => {
    render(<RecallConsole snapshot={snapshot} />);
    expect(screen.getByRole('list', { name: /fixture session audit/i })).toBeVisible();
    expect(screen.getByText(/fixture case opened/i)).toBeVisible();
    expect(screen.queryByText(/desktop evidence map/i)).not.toBeInTheDocument();
    expect(screen.getByText(/5 recorded entities · 4 directed lineage edges · fixture snapshot/i)).toBeVisible();
  });

  it('renders actual edge connections and closes a modal with Escape returning focus', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', fixtureFetch());
    render(<RecallConsole snapshot={snapshot} />);
    await user.click(screen.getByRole('button', { name: /approve ranking-v2/i }));
    await user.click(screen.getByRole('button', { name: /approve relevance-v4/i }));
    await user.click(screen.getByRole('button', { name: /record fixture writeback/i }));
    const close = screen.getByRole('button', { name: /^close case$/i });
    await user.click(close);
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByLabelText(/lineage edge connections/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^close case$/i })).toHaveFocus();
  });

  it('uses a native dialog and keeps an approval transport failure recoverable', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<RecallConsole snapshot={snapshot} />);
    await user.click(screen.getByRole('button', { name: /approve ranking-v2/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/approval.*unavailable/i);
    expect(screen.getByRole('button', { name: /approve ranking-v2/i })).toBeEnabled();

    vi.stubGlobal('fetch', fixtureFetch());
    await user.click(screen.getByRole('button', { name: /approve ranking-v2/i }));
    await user.click(screen.getByRole('button', { name: /approve relevance-v4/i }));
    await user.click(screen.getByRole('button', { name: /record fixture writeback/i }));
    await user.click(screen.getByRole('button', { name: /^close case$/i }));
    expect(screen.getByRole('dialog').tagName).toBe('DIALOG');
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('sends the retained writeback reference and keeps verification transport unavailable', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ approved: 'urn:model:ranking-v2' }))
      .mockResolvedValueOnce(jsonResponse({ approved: 'urn:model:relevance-v4' }))
      .mockResolvedValueOnce(jsonResponse({ writeback: 'fixture:closure-writeback' }))
      .mockResolvedValueOnce(jsonResponse({ receipt: { payload: { caseId: 'case' }, digest: 'receipt' } }))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    render(<RecallConsole snapshot={snapshot} />);

    await user.click(screen.getByRole('button', { name: /approve ranking-v2/i }));
    await user.click(screen.getByRole('button', { name: /approve relevance-v4/i }));
    await user.click(screen.getByRole('button', { name: /record fixture writeback/i }));
    await user.click(screen.getByRole('button', { name: /^close case$/i }));
    await user.click(screen.getByRole('button', { name: /issue closure receipt/i }));

    const closeBody = JSON.parse(String(fetchMock.mock.calls[3][1]?.body)) as {
      writebackRef: string;
    };
    expect(closeBody.writebackRef).toBe('fixture:closure-writeback');
    await user.click(screen.getByRole('button', { name: /verify trusted match/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/verification.*unavailable/i);
    expect(screen.queryByText(/planted mismatch detected/i)).not.toBeInTheDocument();
  });

  it('disables both receipt verification controls while verification is pending', async () => {
    const user = userEvent.setup();
    const pending = deferred<Response>();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ approved: 'urn:model:ranking-v2' }))
      .mockResolvedValueOnce(jsonResponse({ approved: 'urn:model:relevance-v4' }))
      .mockResolvedValueOnce(jsonResponse({ writeback: 'fixture:closure-writeback' }))
      .mockResolvedValueOnce(jsonResponse({ receipt: { payload: { caseId: 'case' }, digest: 'receipt' } }))
      .mockReturnValueOnce(pending.promise);
    vi.stubGlobal('fetch', fetchMock);
    render(<RecallConsole snapshot={snapshot} />);

    await completeClosure(user);
    await user.click(screen.getByRole('button', { name: /verify trusted match/i }));

    expect(screen.getByRole('button', { name: /verify trusted match/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /plant mismatch evidence/i })).toBeDisabled();
  });
});

async function completeClosure(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: /approve ranking-v2/i }));
  await user.click(screen.getByRole('button', { name: /approve relevance-v4/i }));
  await user.click(screen.getByRole('button', { name: /record fixture writeback/i }));
  await user.click(screen.getByRole('button', { name: /^close case$/i }));
  await user.click(screen.getByRole('button', { name: /issue closure receipt/i }));
}

function deferred<Value>() {
  const promise = new Promise<Value>(() => undefined);
  return { promise };
}
