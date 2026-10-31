import { headers } from "next/headers";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../estilos";
import {
  BotonAccesoHogar,
  BotonBlanquear,
  BotonQuitar,
  CodigoInvitacion,
  FormularioContrasena,
  FormularioInvitacion,
} from "./formularios";

interface Invitacion {
  codigo: string;
  hogar_id: string | null;
  rol: string;
  email: string | null;
  nota: string | null;
  vence: string;
  usada: string | null;
}

interface Usuario {
  usuario_id: string;
  email: string;
  creado: string;
  ultimo_ingreso: string | null;
  hogar_id: string | null;
  hogar: string | null;
  hogar_activo: boolean | null;
  rol: string | null;
}

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "—";

function Invitaciones({ lista, origen }: { lista: Invitacion[]; origen: string }) {
  const pendientes = lista.filter((i) => !i.usada);
  const usadas = lista.filter((i) => i.usada);
  return (
    <>
      {pendientes.length > 0 && (
        <ul className="flex flex-col divide-y divide-black/5 dark:divide-white/10">
          {pendientes.map((i) => {
            const vencida = new Date(i.vence) < new Date();
            return (
              <li key={i.codigo} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="text-sm">
                  {i.email ?? "Cualquier email"}
                  {i.nota && <span className={textoSuave}> · {i.nota}</span>}
                  <div className={`text-xs ${vencida ? "text-red-600" : textoSuave}`}>
                    {vencida ? "Venció" : "Vence"} el {fecha(i.vence)}
                    {i.hogar_id && i.rol === "admin" && " · admin"}
                  </div>
                </div>
                <CodigoInvitacion codigo={i.codigo} link={`${origen}/login?invitacion=${i.codigo}`} />
              </li>
            );
          })}
        </ul>
      )}
      {usadas.length > 0 && (
        <p className={`text-xs ${textoSuave}`}>
          Usadas: {usadas.map((i) => `${i.email ?? i.nota ?? i.codigo} (${fecha(i.usada)})`).join(", ")}
        </p>
      )}
    </>
  );
}

export default async function Accesos() {
  const { supabase, usuarioId } = await requerirUsuario();
  const encabezados = await headers();
  const origen = `${encabezados.get("x-forwarded-proto") ?? "https"}://${encabezados.get("host")}`;

  const { data: hogar } = await supabase.rpc("mi_hogar");
  const [miembros, adminHogar, adminApp, invitaciones] = await Promise.all([
    supabase.rpc("miembros_de_mi_hogar"),
    supabase.rpc("es_admin_del_hogar", { hogar }),
    supabase.rpc("es_administrador"),
    supabase
      .from("invitaciones")
      .select("codigo, hogar_id, rol, email, nota, vence, usada")
      .order("creada", { ascending: false }),
  ]);
  const esAdmin = Boolean(adminHogar.data);
  const esAdminApp = Boolean(adminApp.data);
  const lista = (invitaciones.data ?? []) as Invitacion[];
  const usuarios = esAdminApp ? (((await supabase.rpc("usuarios_de_la_app")).data ?? []) as Usuario[]) : [];
  const sinHogar = usuarios.filter((u) => !u.hogar_id);

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Accesos</h1>
        <p className={`mt-1 text-sm ${textoSuave}`}>
          La app es privada: solo se puede crear una cuenta con un código de invitación. Cada hogar ve únicamente sus
          propios datos.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tu hogar</h2>
        <ul className={`${caja} divide-y divide-black/5 dark:divide-white/10`}>
          {(miembros.data ?? []).map((m: { usuario_id: string; email: string; rol: string; yo: boolean }) => (
            <li key={m.usuario_id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                {m.email}
                <span className={textoSuave}>
                  {" "}
                  · {m.rol === "admin" ? "admin" : "miembro"}
                  {m.yo && " · vos"}
                </span>
              </span>
              {esAdmin && !m.yo && (
                <span className="flex items-center gap-4">
                  <BotonBlanquear usuario={m.usuario_id} email={m.email} />
                  <BotonQuitar usuario={m.usuario_id} email={m.email} />
                </span>
              )}
            </li>
          ))}
        </ul>
        {esAdmin && (
          <div className={`${caja} flex flex-col gap-4 p-5`}>
            <div>
              <h3 className="font-medium">Invitar a tu hogar</h3>
              <p className={`text-sm ${textoSuave}`}>
                Quien use el código ve y carga los mismos datos que vos. Vale por 14 días y una sola vez.
              </p>
            </div>
            <FormularioInvitacion licencia={false} />
            <Invitaciones lista={lista.filter((i) => i.hogar_id)} origen={origen} />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tu contraseña</h2>
        <div className={`${caja} p-5`}>
          <FormularioContrasena />
        </div>
      </section>

      {esAdminApp && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Administración de la app</h2>
          <div className={`${caja} flex flex-col gap-4 p-5`}>
            <div>
              <h3 className="font-medium">Licencias</h3>
              <p className={`text-sm ${textoSuave}`}>
                Una licencia crea un hogar nuevo y vacío, separado del tuyo. Vale por 14 días y una sola vez.
              </p>
            </div>
            <FormularioInvitacion licencia />
            <Invitaciones lista={lista.filter((i) => !i.hogar_id)} origen={origen} />
          </div>

          <div className={`${caja} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className={`text-left text-xs ${textoSuave}`}>
                <tr>
                  <th className="px-4 py-2 font-normal">Cuenta</th>
                  <th className="px-4 py-2 font-normal">Hogar</th>
                  <th className="px-4 py-2 font-normal">Creada</th>
                  <th className="px-4 py-2 font-normal">Último ingreso</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {usuarios
                  .filter((u) => u.hogar_id)
                  .map((u) => (
                    <tr key={`${u.usuario_id}-${u.hogar_id}`} className={u.hogar_activo ? "" : "opacity-60"}>
                      <td className="px-4 py-2">
                        <div className="flex flex-col items-start gap-1">
                          {u.email}
                          {u.usuario_id !== usuarioId && <BotonBlanquear usuario={u.usuario_id} email={u.email} />}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {u.hogar_id === hogar ? "El tuyo" : u.hogar}
                        {!u.hogar_activo && <span className="ml-1 text-xs text-red-600">suspendido</span>}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{fecha(u.creado)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{fecha(u.ultimo_ingreso)}</td>
                      <td className="px-4 py-2 text-right">
                        {u.hogar_id !== hogar && u.hogar_id && (
                          <BotonAccesoHogar hogar={u.hogar_id} activo={Boolean(u.hogar_activo)} />
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {sinHogar.length > 0 && (
              <p className={`px-4 pb-3 text-xs ${textoSuave}`}>
                Sin hogar (no ven nada): {sinHogar.map((u) => u.email).join(", ")}
              </p>
            )}
          </div>
          <p className={`text-xs ${textoSuave}`}>
            Suspender un hogar le corta el acceso a todos sus miembros sin borrar nada. Blanquear una contraseña cierra
            la sesión de esa persona y te da una provisoria para pasarle; al entrar con ella elige una nueva. Para
            borrar una cuenta del todo, usá Authentication → Users en Supabase.
          </p>
        </section>
      )}
    </div>
  );
}
