import { Fragment } from "react";

/**
 * Renderizador mínimo e seguro (sem HTML bruto) para textos do blog/páginas:
 * parágrafos, "## títulos", "### subtítulos", "- listas", **negrito** e [links](https://…).
 */
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\))/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (m) {
      const ext = m[2].startsWith("http");
      return (
        <a key={i} href={m[2]} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {m[1]}
        </a>
      );
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function SimpleMarkdown({ text }: { text: string }) {
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  return (
    <div className="prose-site">
      {blocks.map((b, i) => {
        const t = b.trim();
        if (t.startsWith("### ")) return <h3 key={i}>{inline(t.slice(4))}</h3>;
        if (t.startsWith("## ")) return <h2 key={i}>{inline(t.slice(3))}</h2>;
        if (t.split("\n").every((l) => l.trim().startsWith("- "))) {
          return (
            <ul key={i}>
              {t.split("\n").map((l, j) => (
                <li key={j}>{inline(l.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(t)}</p>;
      })}
    </div>
  );
}
