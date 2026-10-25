import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { configSupabase } from "./config";

/** Cliente de Supabase para componentes de servidor, acciones y rutas. Uno por request. */
export async function crearCliente() {
  const almacen = await cookies();
  const config = configSupabase();
  if (!config) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return createServerClient(config.url, config.clave, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll(aGuardar) {
        try {
          aGuardar.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // Desde un componente de servidor no se pueden escribir cookies; el proxy ya renovó la sesión.
        }
      },
    },
  });
}

/** Cliente y usuario de la sesión; si no hay sesión, va al login. Usar en cada página y acción. */
export async function requerirUsuario() {
  if (!configSupabase()) {
    await cookies(); // la página depende de la sesión: nunca se prerenderiza
    redirect("/login");
  }
  const supabase = await crearCliente();
  const { data } = await supabase.auth.getClaims();
  const usuarioId = data?.claims.sub;
  if (!usuarioId) redirect("/login");
  return { supabase, usuarioId };
}
