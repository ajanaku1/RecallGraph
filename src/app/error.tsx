'use client';

import { JourneyStatus } from './journey-status';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({
  error: _error,
  reset,
}: ErrorBoundaryProps): React.JSX.Element {
  return <JourneyStatus state="error" retry={reset} />;
}
