export type JourneyViewState = 'ready' | 'loading' | 'error' | 'not-found';

interface JourneyStatusProps {
  state: Exclude<JourneyViewState, 'ready'>;
  retry?: () => void;
}

export function JourneyStatus({
  state,
  retry,
}: JourneyStatusProps): React.JSX.Element {
  if (state === 'loading') {
    return (
      <section className="journey-status" role="status">
        Loading recorded fixture case…
      </section>
    );
  }

  if (state === 'not-found') {
    return (
      <section className="journey-status" role="status">
        <h1>Fixture case not found</h1>
        {retry && <button onClick={retry}>Retry fixture lookup</button>}
      </section>
    );
  }

  return (
    <section className="journey-status" role="alert">
      <h1>Fixture command error</h1>
      <p>Recorded fixture state could not be loaded.</p>
      {retry && <button onClick={retry}>Retry fixture command</button>}
    </section>
  );
}
