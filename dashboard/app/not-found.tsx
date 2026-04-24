import Link from "next/link";

export default function NotFound() {
  return (
    <main className="landing-shell">
      <section className="card mx-auto mt-16 max-w-xl text-center">
        <p className="card-title">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Page not found</h1>
        <p className="mt-3 text-sm text-zinc-400">
          The page you are looking for does not exist or may have moved.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="button button-secondary">
            Go home
          </Link>
          <Link href="/agents" className="button button-primary">
            Open dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
