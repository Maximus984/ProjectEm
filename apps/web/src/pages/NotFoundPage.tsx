import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="space-y-4 text-center">
      <h1 className="font-display text-4xl text-white">404</h1>
      <p className="text-sm text-mist">Route not found.</p>
      <Link to="/" className="rounded-full border border-white/30 px-4 py-2 text-sm">
        Go Home
      </Link>
    </section>
  );
}
