"use client";

import { useActionState, useState, useTransition } from "react";
import { boton, botonSecundario, campo, etiqueta } from "../../estilos";
import {
  blanquearContrasena,
  borrarInvitacion,
  cambiarAccesoHogar,
  cambiarContrasena,
  crearInvitacion,
  quitarMiembro,
  type ResultadoBlanqueo,
} from "./acciones";

export function FormularioInvitacion({ licencia }: { licencia: boolean }) {
  const [estado, accion, pendiente] = useActionState(crearInvitacion.bind(null, licencia), {});
  return (
    <form action={accion} className="flex flex-wrap items-end gap-3">
      <label className={`${etiqueta} min-w-48 flex-1`}>
        Email de la persona (opcional)
        <input name="email" type="email" autoComplete="off" className={campo} />
      </label>
      {licencia ? (
        <label className={`${etiqueta} min-w-40 flex-1`}>
          Nota (opcional)
          <input name="nota" maxLength={80} placeholder="Para quién es" className={campo} />
        </label>
      ) : (
        <label className={etiqueta}>
          Permisos
          <select name="rol" className={campo} defaultValue="miembro">
            <option value="miembro">Miembro</option>
            <option value="admin">Admin (puede invitar)</option>
          </select>
        </label>
      )}
      <button type="submit" disabled={pendiente} className={boton}>
        {licencia ? "Crear licencia" : "Crear invitación"}
      </button>
      {estado.error && <p className="w-full text-sm text-red-600">{estado.error}</p>}
    </form>
  );
}

/** Código con el link para compartir y el botón para copiarlo. */
export function CodigoInvitacion({ codigo, link }: { codigo: string; link: string }) {
  const [copiado, setCopiado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded bg-black/5 px-2 py-1 font-mono text-sm tracking-wider dark:bg-white/10">
        {codigo.match(/.{1,4}/g)?.join("-")}
      </code>
      <button
        type="button"
        className={`${botonSecundario} px-2 py-1 text-xs`}
        onClick={() =>
          navigator.clipboard.writeText(link).then(() => {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          })
        }
      >
        {copiado ? "¡Copiado!" : "Copiar link"}
      </button>
      <button
        type="button"
        disabled={pendiente}
        className={`text-xs text-red-600 underline`}
        onClick={() => iniciar(() => borrarInvitacion(codigo))}
      >
        Anular
      </button>
    </div>
  );
}

export function BotonQuitar({ usuario, email }: { usuario: string; email: string }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      className="text-xs text-red-600 underline"
      onClick={() =>
        confirm(`¿Quitar a ${email} del hogar? Deja de ver los datos.`) && iniciar(() => quitarMiembro(usuario))
      }
    >
      Quitar
    </button>
  );
}

export function BotonAccesoHogar({ hogar, activo }: { hogar: string; activo: boolean }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      className={`${botonSecundario} px-2 py-1 text-xs ${activo ? "text-red-600" : ""}`}
      onClick={() => iniciar(() => cambiarAccesoHogar(hogar, !activo))}
    >
      {activo ? "Suspender" : "Reactivar"}
    </button>
  );
}

/** Genera una contraseña provisoria para otra cuenta y la muestra para pasársela a la persona. */
export function BotonBlanquear({ usuario, email }: { usuario: string; email: string }) {
  const [resultado, setResultado] = useState<ResultadoBlanqueo>({});
  const [copiado, setCopiado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  if (resultado.provisoria) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <code className="rounded bg-black/5 px-2 py-1 font-mono text-sm tracking-wider dark:bg-white/10">
            {resultado.provisoria}
          </code>
          <button
            type="button"
            className={`${botonSecundario} px-2 py-1 text-xs`}
            onClick={() => navigator.clipboard.writeText(resultado.provisoria!).then(() => setCopiado(true))}
          >
            {copiado ? "¡Copiada!" : "Copiar"}
          </button>
        </div>
        <span className="max-w-64 text-xs opacity-70">Pasásela a {email}: al entrar va a elegir una nueva.</span>
      </div>
    );
  }
  return (
    <span className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pendiente}
        className="text-xs whitespace-nowrap underline"
        onClick={() =>
          confirm(
            `¿Blanquear la contraseña de ${email}? Se cierra su sesión y vas a ver una contraseña provisoria para pasarle.`,
          ) && iniciar(async () => setResultado(await blanquearContrasena(usuario)))
        }
      >
        Blanquear contraseña
      </button>
      {resultado.error && <span className="text-xs text-red-600">{resultado.error}</span>}
    </span>
  );
}

export function FormularioContrasena({ obligatorio = false }: { obligatorio?: boolean }) {
  const [estado, accion, pendiente] = useActionState(cambiarContrasena, {});
  return (
    <form action={accion} className="flex flex-wrap items-end gap-3">
      <label className={`${etiqueta} min-w-48 flex-1`}>
        Contraseña nueva
        <input name="clave" type="password" autoComplete="new-password" required minLength={8} className={campo} />
      </label>
      <label className={`${etiqueta} min-w-48 flex-1`}>
        Repetila
        <input name="repetir" type="password" autoComplete="new-password" required minLength={8} className={campo} />
      </label>
      <button type="submit" disabled={pendiente} className={boton}>
        {obligatorio ? "Guardar y entrar" : "Cambiar contraseña"}
      </button>
      {estado.error && <p className="w-full text-sm text-red-600">{estado.error}</p>}
      {estado.ok && !obligatorio && (
        <p className="w-full text-sm text-green-700 dark:text-green-400">Listo, ya la cambiaste.</p>
      )}
    </form>
  );
}
