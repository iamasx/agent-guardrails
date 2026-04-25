"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  h1: ({ children }) => <h1 className="mb-3 text-[18px] font-semibold tracking-tight text-[#e6e9f2]">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-6 text-[14px] font-semibold uppercase tracking-[0.02em] text-blue-300">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-5 text-base font-medium text-zinc-200">{children}</h3>,
  p: ({ children }) => <p className="mb-2.5 text-[13.5px] leading-[1.65] text-[#e6e9f2]">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 text-[13.5px] text-[#e6e9f2]">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-[13.5px] text-[#e6e9f2]">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-[#e6e9f2]">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-200">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-[#2a3142] pl-3 italic text-[#8a93a8]">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="break-words text-blue-300 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-200"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return <code className={`${className ?? ""} block`}>{children}</code>;
    }
    return (
      <code className="rounded bg-[#151925] px-1.5 py-0.5 font-mono text-[12px] text-amber-300">{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-4 max-h-[min(24rem,50vh)] overflow-x-auto overflow-y-auto rounded-md border border-[#1e2433] bg-[#10131c] p-4 text-sm text-zinc-300">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-8 border-[#1e2433]" />,
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-md border border-[#1e2433]">
      <table className="w-full min-w-[20rem] border-collapse text-left text-[12.5px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-[#1e2433] bg-[#10131c]">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-[#1e2433] last:border-b-0">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#8a93a8]">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 font-mono text-[12px] text-[#e6e9f2]">{children}</td>,
};

export function ReportMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="report-markdown max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
