import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-start justify-center px-6 py-16">
      <section className="mx-auto w-full max-w-xl rounded-lg border border-zinc-800 bg-zinc-900/80 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur">
        <p className="text-lg font-semibold tracking-wide text-zinc-100">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Page not found</h1>
        <p className="mt-3 text-sm text-zinc-400">
          The page you are looking for does not exist or may have moved.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
          >
            Go home
          </Link>
          <Link
            href="/agents"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Open dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
