import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '../../src/app/error';
import Loading from '../../src/app/loading';
import NotFound from '../../src/app/not-found';

describe('App Router recovery boundaries', () => {
  it('renders the branded fixture loading status', () => {
    render(<Loading />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading recorded fixture case/i);
  });

  it('renders a recoverable fixture error without exposing error details', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<ErrorBoundary error={new Error('secret upstream detail')} reset={reset} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/fixture command error/i);
    expect(screen.queryByText(/secret upstream detail/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry fixture command/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('renders a safe fixture route retry from the not-found boundary', () => {
    render(<NotFound />);

    expect(screen.getByRole('status')).toHaveTextContent(/fixture case not found/i);
    expect(screen.getByRole('link', { name: /return to fixture command/i }))
      .toHaveAttribute('href', '/');
  });
});
