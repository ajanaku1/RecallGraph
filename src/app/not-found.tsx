import Link from 'next/link';

export default function NotFound(): React.JSX.Element {
  return (
    <section className="journey-status" role="status">
      <h1>Fixture case not found</h1>
      <p>No recorded fixture route is available at this address.</p>
      <Link className="recovery-link" href="/">
        Return to fixture command
      </Link>
    </section>
  );
}
