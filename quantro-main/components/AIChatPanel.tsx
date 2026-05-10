import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Loader2, MessageCircle, Send, Sparkles, User, X } from 'lucide-react';
import { sendAIChat } from '../lib/api';
import type { AIChatMessage, ScoreResponse } from '../types';

interface AIChatPanelProps {
  property: ScoreResponse;
}

const assistantMarkdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-base font-bold text-gray-900 mt-3 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-sm font-bold text-gray-900 mt-3 mb-1.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold text-gray-800 mt-2 mb-1 first:mt-0">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm text-gray-700 mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-4 mb-2 space-y-1 text-sm text-gray-700 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-4 mb-2 space-y-1 text-sm text-gray-700 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed pl-0.5">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-gray-700">{children}</em>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} className="text-blue-600 underline underline-offset-2 hover:text-blue-800 break-all" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return <code className={`${className} font-mono text-xs`}>{children}</code>;
    }
    return (
      <code className="rounded bg-gray-200/90 px-1.5 py-0.5 font-mono text-[0.8125rem] text-gray-800">{children}</code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-gray-800 p-3 text-xs text-gray-100">{children}</pre>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 border-l-2 border-gray-300 pl-3 text-sm italic text-gray-600">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-gray-200" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-gray-100">{children}</thead>,
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border-b border-gray-200 px-2 py-1.5 font-semibold text-gray-800">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-b border-gray-100 px-2 py-1.5 text-gray-700">{children}</td>
  ),
};

export const AIChatPanel: React.FC<AIChatPanelProps> = ({ property }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('');
  const [warning, setWarning] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const nextMessages: AIChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setQuestion('');
    setError('');
    setWarning('');
    setLoading(true);
    try {
      const res = await sendAIChat(trimmed, property, messages);
      if (res.error) {
        setError(res.error);
      } else {
        setMessages([...nextMessages, { role: 'assistant', content: res.answer }]);
        setProvider(res.provider);
        setWarning(res.warnings?.[0] || '');
      }
    } catch (err: any) {
      setError(err.message || 'AI chat failed');
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Why is this a good or risky CLT acquisition?',
    'What due diligence should we do next?',
    'Summarize this for a board memo.',
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollTop = el.scrollHeight;
  }, [open, messages, loading]);

  return (
    <>
      <div className="fixed bottom-5 right-5 z-[900]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-gray-800 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Chat
          {messages.length > 0 && (
            <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
              {messages.length}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div
          role="presentation"
          className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-end sm:justify-end bg-black/25 p-3 sm:p-5"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-chat-panel-title"
            className="flex h-[min(88vh,calc(100dvh-4rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 pointer-events-auto mb-14 sm:mb-16 sm:max-h-[min(88vh,calc(100dvh-5rem))]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-yellow-500 shrink-0" />
                <div className="min-w-0">
                  <h3 id="ai-chat-panel-title" className="text-sm font-bold text-gray-800">
                    Chat about this property
                  </h3>
                  <p className="truncate text-[11px] text-gray-400">{property.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {provider && (
                  <span className="hidden sm:inline text-[11px] text-gray-400">
                    {provider === 'local' ? 'local summary' : provider}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-5 pt-4">
              {messages.length === 0 ? (
                <div className="grid grid-cols-1 gap-2 mb-4 shrink-0">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="text-left rounded-xl bg-gray-50 hover:bg-gray-100 px-3 py-2 text-xs text-gray-600 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  ref={scrollRef}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-3 mb-4 pr-1"
                >
                  {messages.map((m, i) => (
                    <div key={`${m.role}-${i}`} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.role === 'assistant' && <Bot className="w-4 h-4 mt-2 text-gray-400 shrink-0" />}
                      <div
                        className={`max-w-[min(100%,22rem)] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
                          m.role === 'user' ? 'bg-black text-white' : 'bg-gray-50 text-gray-800'
                        }`}
                      >
                        {m.role === 'assistant' ? (
                          <div className="[&>*:first-child]:mt-0">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={assistantMarkdownComponents}>
                              {m.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <span className="whitespace-pre-wrap">{m.content}</span>
                        )}
                      </div>
                      {m.role === 'user' && <User className="w-4 h-4 mt-2 text-gray-400 shrink-0" />}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Thinking through the score context...
                    </div>
                  )}
                </div>
              )}

              {warning && (
                <div className="mb-3 shrink-0 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-700">
                  {warning}
                </div>
              )}
              {error && (
                <div className="mb-3 shrink-0 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  {error}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(question);
                }}
                className="mt-auto flex shrink-0 items-center gap-2 border-t border-gray-100 pt-4"
              >
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about risks, strengths, or due diligence..."
                  className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-gray-400"
                />
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
