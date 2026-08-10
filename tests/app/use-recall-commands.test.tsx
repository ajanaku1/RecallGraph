import { act, renderHook } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialJourneyState, recallReducer } from '../../src/app/recall-reducer';
import { useRecallCommands } from '../../src/app/use-recall-commands';

const ranking = 'urn:model:ranking-v2';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('recall command transport boundary', () => {
  it('rejects mixed approval responses instead of fail-opening approval', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      approved: ranking,
      writeback: 'fixture:closure-writeback',
    })));
    const { result } = renderHook(useHarness);

    await act(() => result.current.commands.approve(ranking));

    expect(result.current.state.approvedAssetIds).toEqual([]);
    expect(result.current.state.approvalError).toMatch(/approval unavailable/i);
  });

  it.each([
    {},
    [],
    { writeback: 'fixture:closure-writeback' },
    { approved: 'urn:model:relevance-v4' },
  ])('rejects invalid approval response shape %j', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));
    const { result } = renderHook(useHarness);

    await act(() => result.current.commands.approve(ranking));

    expect(result.current.state.approvedAssetIds).toEqual([]);
    expect(result.current.state.approvalError).toMatch(/approval unavailable/i);
  });

  it('treats non-success approval responses as recoverable approval failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ approved: ranking }, 503)));
    const { result } = renderHook(useHarness);

    await act(() => result.current.commands.approve(ranking));

    expect(result.current.state.approvedAssetIds).toEqual([]);
    expect(result.current.state.approvalError).toMatch(/approval unavailable/i);
  });

  it('recovers an approval control after its request times out', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(() => undefined)));
    const { result } = renderHook(useHarness);

    act(() => { void result.current.commands.approve(ranking); });
    await act(() => vi.advanceTimersByTimeAsync(5_000));

    expect(result.current.state.approvalError).toMatch(/approval unavailable/i);
  });

  it('keeps the newest verification intent when deferred requests resolve out of order', async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise));
    const { result } = renderHook(useHarness);
    act(() => result.current.dispatch({ type: 'receipt-issued', receipt: receipt('digest') }));

    act(() => { void result.current.commands.verify(false); });
    act(() => { void result.current.commands.verify(true); });
    await act(async () => { second.resolve(jsonResponse({ match: false, disclaimer: 'fixture' })); });
    await act(async () => { first.resolve(jsonResponse({ match: true, disclaimer: 'fixture' })); });

    expect(result.current.state.verification).toBe('mismatch');
  });
});

function useHarness() {
  const [state, dispatch] = useReducer(recallReducer, ranking, initialJourneyState);
  return { state, dispatch, commands: useRecallCommands(state, dispatch) };
}

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function receipt(digest: string) {
  return { payload: { caseId: 'fixture' }, digest };
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}
