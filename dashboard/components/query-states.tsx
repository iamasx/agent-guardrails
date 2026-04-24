"use client";

import type { ReactNode } from "react";
import { getErrorMessage } from "@/lib/api/client";

export function QueryLoading({
  message = "Loading…",
  listSkeleton,
}: {
  message?: string;
  listSkeleton?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4 backdrop-blur-sm">
      <p className="rounded-lg border border-dashed border-zinc-700/50 bg-zinc-900/30 px-4 py-8 text-center text-sm text-zinc-400 transition-colors duration-200">{message}</p>
      {listSkeleton ? (
        <div className="flex flex-col gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg border border-zinc-800/80 bg-[length:220%_100%] bg-[linear-gradient(110deg,rgba(39,39,42,0.58)_8%,rgba(59,130,246,0.17)_18%,rgba(39,39,42,0.58)_33%)] bg-zinc-900/50 animate-[shimmer_1.3s_linear_infinite]" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function QueryError({
  error,
  onRetry,
  title = "Something went wrong",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-4 backdrop-blur-sm">
      <p className="text-sm font-medium text-rose-200">{title}</p>
      <p className="mt-1 text-sm text-rose-300/90">{getErrorMessage(error)}</p>
      {onRetry ? (
        <button
          type="button"
          className="mt-3 rounded-md border border-rose-800/60 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-100 hover:bg-rose-950/60"
          onClick={onRetry}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function QueryEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-center backdrop-blur-sm">
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      {description ? <p className="mt-2 text-sm text-zinc-500">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}
