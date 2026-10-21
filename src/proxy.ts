import { NextResponse, type NextRequest } from "next/server";

/**
 * Verificação otimista: sem cookie de sessão, nem renderiza áreas privadas.
 * A autorização real (sessão válida + papel) acontece no servidor em cada página/ação.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("sid");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/cliente", "/cliente/:path*"],
};
