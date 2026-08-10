import type { Metadata } from 'next';
import './recall.css';

export const metadata: Metadata = {
  title: 'RecallGraph — Recall Command',
  description: 'Fixture-only RecallGraph closure journey.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
