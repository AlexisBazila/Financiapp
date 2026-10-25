import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configSupabase } from "@/lib/supabase/config";

const PUBLICAS = ["/login", "/auth", "/ejemplo"];

/** Renueva la sesión de Supabase en cada navegación y manda al login a quien no la tiene. */
export async function proxy(request: NextRequest) {
  const config = configSupabase();
  if (!config) return NextResponse.next();

  let respuesta = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.clave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(aGuardar, encabezados) {
        aGuardar.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        aGuardar.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        Object.entries(encabezados).forEach(([clave, valor]) => respuesta.headers.set(clave, valor));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const publica = PUBLICAS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!data?.claims && !publica) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
