import React, { useEffect, useState } from 'react';
import { Bot, Loader2, MessageCircle, Send, Sparkles, User, X } from 'lucide-react';
import { sendAIChat } from '../lib/api';
import type { AIChatMessage, ScoreResponse } from '../types';

interface AIChatPanelProps {
  property: ScoreResponse;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({ property }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('');
  const [warning, setWarning] = useState('');

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
          className="fixed inset-0 z-[1000] flex items-end justify-end bg-black/25 p-4 sm:p-5 sm:items-end sm:justify-end"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-chat-panel-title"
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 mb-14 sm:mb-16 pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-yellow-500 shrink-0" />
                <div className="min-w-0">
                  <h3 id="ai-chat-panel-title" className="text-sm font-bold text-gray-800">
                    Chat about this property
                  </h3>
                  <p className="truncate text-[11px] text-gray-400">{property.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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

            <div className="p-5">
              {messages.length === 0 ? (
                <div className="grid grid-cols-1 gap-2 mb-4">
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
                <div className="max-h-[48vh] overflow-y-auto space-y-3 mb-4 pr-1">
                  {messages.map((m, i) => (
                    <div key={`${m.role}-${i}`} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.role === 'assistant' && <Bot className="w-4 h-4 mt-2 text-gray-400 shrink-0" />}
                      <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-black text-white' : 'bg-gray-50 text-gray-700'}`}>
                        {m.content}
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
                <div className="mb-3 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-700">
                  {warning}
                </div>
              )}
              {error && (
                <div className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  {error}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(question);
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about risks, strengths, or due diligence..."
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-gray-400"
                />
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
