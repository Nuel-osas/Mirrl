"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Compact markdown styling tuned for chat bubbles (no typography plugin needed).
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 break-words text-[15px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="marker:text-muted-2">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic text-muted">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-brand-to underline underline-offset-2 hover:opacity-80">
              {children}
            </a>
          ),
          h1: ({ children }) => <h1 className="mt-1 text-lg font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-1 text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-1 text-sm font-semibold">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border-strong pl-3 text-muted">{children}</blockquote>
          ),
          code: ({ className, children }) => {
            const block = (className ?? "").includes("language-");
            return block ? (
              <code className="block overflow-x-auto rounded-lg bg-background/60 p-3 font-mono text-[13px]">{children}</code>
            ) : (
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px]">{children}</code>
            );
          },
          pre: ({ children }) => <pre className="overflow-x-auto">{children}</pre>,
          table: ({ children }) => (
            <table className="w-full border-collapse text-sm">{children}</table>
          ),
          th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-medium">{children}</th>,
          td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
