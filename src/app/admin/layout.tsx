import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ExternalLink, LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { logout } from "@/server/auth-actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s — Painel" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const newQuotes = await db.$count(schema.quoteRequests, eq(schema.quoteRequests.status, "novo"));
  return (
    <div className="min-h-dvh bg-ink-2/60">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-ink px-5">
        <Link href="/admin" className="flex items-center gap-3">
          <Logo className="text-[0.95rem]" />
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-mist">Painel</span>
        </Link>
        <div className="mr-12 flex items-center gap-4 text-sm lg:mr-0">
          <Link href="/" target="_blank" className="hidden items-center gap-1 text-mist hover:text-paper sm:flex">
            Ver site <ExternalLink className="size-3.5" aria-hidden />
          </Link>
          <span className="hidden text-mist md:inline">{user.email}</span>
          <form action={logout}>
            <button className="flex items-center gap-1 text-mist hover:text-paper" aria-label="Sair">
              <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Sair</span>
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1500px]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-line bg-ink px-3 py-6 lg:block">
          <AdminNav newQuotes={newQuotes} />
        </aside>
        <div className="lg:hidden">
          <AdminNav newQuotes={newQuotes} />
        </div>
        <main id="conteudo" className="min-w-0 flex-1 px-4 py-8 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
