import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { BookOpenText, Send, Square, RotateCcw } from "lucide-react";

const STORAGE_KEY = "biopave-guide-chat";
const SUGGESTIONS = [
  "How is the Rutting Risk Index calculated?",
  "Walk me through today's numbers step by step",
  "What sources is the master curve based on?",
];

export default function GuideChat({ snapshot }: { snapshot: Record<string, unknown> }) {
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: "biopave-guide",
    transport: new DefaultChatTransport({ api: "/api/chat", body: () => ({ snapshot: snapRef.current }) }),
    onError: (e) => {
      const m = e.message || "";
      setError(m.includes("402") ? "AI credits are exhausted. Add credits in Settings → Plans & credits." : m.includes("429") ? "Too many requests — please wait a moment and try again." : "The assistant couldn't respond. Check your connection and try again.");
    },
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw) as UIMessage[]);
    } catch { /* ignore */ }
    setLoaded(true);
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loaded && status !== "streaming" && status !== "submitted") localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ block: "nearest" });
    if (status === "ready") inputRef.current?.focus();
  }, [messages, status, loaded]);

  const busy = status === "submitted" || status === "streaming";
  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setError(null);
    sendMessage({ text });
    setInput("");
  };

  return (
    <div className="panel flex h-[560px] flex-col">
      <div className="panel-title">
        <BookOpenText className="h-3.5 w-3.5" /> BioPave Guide · ask about the math & sources
        <button onClick={() => { setMessages([]); localStorage.removeItem(STORAGE_KEY); }} className="ml-auto flex items-center gap-1 normal-case tracking-normal hover:text-foreground">
          <RotateCcw className="h-3 w-3" /> New chat
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Ask how any number on this dashboard is calculated. I use your live readings and cite sources.</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full rounded-md border border-border px-3 py-2 text-left hover:bg-secondary">{s}</button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" : "guide-prose text-sm"}>
            {m.parts.map((p, i) =>
              p.type === "text" ? (
                m.role === "user" ? <span key={i}>{p.text}</span> : <ReactMarkdown key={i} remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{p.text}</ReactMarkdown>
              ) : p.type === "reasoning" && p.text ? (
                <details key={i} className="mb-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Thinking</summary>{p.text}</details>
              ) : null,
            )}
          </div>
        ))}
        {status === "submitted" && <div className="flex gap-1 text-primary"><span className="animate-blink">●</span><span className="animate-blink [animation-delay:150ms]">●</span><span className="animate-blink [animation-delay:300ms]">●</span></div>}
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex items-end gap-2 rounded-lg border border-input bg-secondary p-2">
        <textarea ref={inputRef} value={input} rows={2} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="e.g. Why is fatigue at 100?" className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        {busy ? (
          <button type="button" onClick={() => stop()} className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground" aria-label="Stop"><Square className="h-4 w-4" /></button>
        ) : (
          <button type="submit" disabled={!input.trim()} className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40" aria-label="Send"><Send className="h-4 w-4" /></button>
        )}
      </form>
    </div>
  );
}
