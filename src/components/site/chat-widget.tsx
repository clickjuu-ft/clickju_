"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUp, Loader2, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };
const PREFILL_KEY = "orcamento-prefill";
const HISTORY_KEY = "assistente-historico";

const SUGGESTIONS = ["Quais serviços vocês oferecem?", "Como funciona a cobertura de corridas?", "Quero um orçamento para um evento"];

/** Assistente virtual. Conversas ficam apenas na sessão do navegador do visitante. */
export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"ai" | "basic" | null>(null);
  const [prefillReady, setPrefillReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const h = sessionStorage.getItem(HISTORY_KEY);
        if (h) setMsgs(JSON.parse(h));
      } catch {
        /* sem armazenamento */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(msgs.slice(-20)));
    } catch {
      /* sem armazenamento */
    }
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname?.startsWith("/admin")) return null;

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...msgs, { role: "user" as const, content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(-20) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha");
      setMode(data.mode);
      setMsgs((m) => [...m, { role: "assistant", content: data.reply }]);
      if (data.prefill && Object.keys(data.prefill).length) {
        try {
          sessionStorage.setItem(PREFILL_KEY, JSON.stringify(data.prefill));
          setPrefillReady(true);
        } catch {
          /* sem armazenamento */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha de conexão.");
    } finally {
      setBusy(false);
    }
  };

  // links internos citados nas respostas (/orcamento) viram clicáveis
  const render = (text: string) =>
    text.split(/(\/orcamento|https:\/\/wa\.me\/\S+)/g).map((part, i) =>
      part === "/orcamento" ? (
        <Link key={i} href="/orcamento" className="underline underline-offset-2" onClick={() => setOpen(false)}>
          formulário de orçamento
        </Link>
      ) : part.startsWith("https://wa.me/") ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          WhatsApp
        </a>
      ) : (
        <span key={i}>{part}</span>
      ),
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="assistente"
        className={cn(
          "fixed bottom-5 right-5 z-[60] flex h-14 items-center justify-center gap-2 rounded-full bg-paper text-xs font-semibold uppercase tracking-[0.14em] text-ink shadow-[0_12px_40px_-12px_rgba(9,9,13,0.5)] transition-colors hover:bg-violet hover:text-white",
          pathname === "/" ? "px-5" : "w-14",
          open && "max-sm:hidden",
        )}
      >
        {open ? <X className="size-5" aria-hidden /> : <MessageSquare className="size-5" aria-hidden />}
        {pathname === "/" ? (
          <span className="hidden sm:inline">{open ? "Fechar" : "Tire suas dúvidas"}</span>
        ) : null}
        <span className={pathname === "/" ? "sr-only sm:hidden" : "sr-only"}>{open ? "Fechar assistente" : "Assistente virtual: tire suas dúvidas"}</span>
      </button>

      {open && (
        <section
          id="assistente"
          role="dialog"
          aria-label="Assistente virtual"
          className="fixed inset-x-0 bottom-0 z-[70] flex h-[85svh] flex-col border border-line bg-ink shadow-2xl animate-fade-in sm:inset-x-auto sm:bottom-24 sm:right-5 sm:h-[560px] sm:w-[380px]"
        >
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Assistente virtual</p>
              <p className="text-[0.7rem] text-mist">
                {mode === "basic" ? "Modo básico: respostas da base de informações (IA não configurada)" : "Respostas automáticas — valores e datas são confirmados pela fotógrafa"}
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center" aria-label="Fechar assistente">
              <X className="size-5" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
            {msgs.length === 0 && (
              <div className="space-y-3">
                <p className="text-mist">Olá! Posso explicar os serviços, como funciona cada cobertura e ajudar você a montar o pedido de orçamento.</p>
                <div className="flex flex-col items-start gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="border border-line px-3 py-2 text-left text-xs hover:border-paper">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <p
                key={i}
                className={cn(
                  "max-w-[85%] whitespace-pre-line px-3 py-2",
                  m.role === "user" ? "ml-auto bg-paper text-ink" : "bg-ink-2 text-paper-2",
                )}
              >
                {m.role === "assistant" ? render(m.content) : m.content}
              </p>
            ))}
            {busy && <Loader2 className="size-4 animate-spin text-lilac" aria-label="Respondendo" />}
            {error && <p className="text-xs text-danger" role="alert">{error}</p>}
            {prefillReady && (
              <Link href="/orcamento?origem=assistente" onClick={() => setOpen(false)} className="block bg-violet px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-white">
                Abrir formulário pré-preenchido
              </Link>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 border-t border-line p-3"
          >
            <label className="sr-only" htmlFor="chat-input">Mensagem</label>
            <textarea
              id="chat-input"
              ref={inputRef}
              rows={1}
              maxLength={2000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Escreva sua dúvida…"
              className="max-h-28 flex-1 resize-none border border-line-strong bg-transparent px-3 py-2 text-sm focus:border-lilac focus:outline-none"
            />
            <button type="submit" disabled={busy || !input.trim()} className="grid size-10 place-items-center bg-paper text-ink disabled:opacity-40" aria-label="Enviar">
              <ArrowUp className="size-4" />
            </button>
          </form>
          <p className="px-3 pb-2 text-[0.65rem] text-mist">Não compartilhe dados sensíveis. <Link href="/privacidade" className="underline">Privacidade</Link></p>
        </section>
      )}
    </>
  );
}
