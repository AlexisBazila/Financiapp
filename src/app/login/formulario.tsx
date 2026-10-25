"use client";

import { useActionState, useState } from "react";
import { boton, campo, etiqueta, textoSuave } from "../estilos";
import { ingresar, registrarse, type EstadoLogin } from "./acciones";

export function FormularioLogin() {
  const [modo, setModo] = useState<"ingresar" | "registrarse">("ingresar");
  const [estadoIngreso, accionIngreso, ingresando] = useActionState<EstadoLogin, FormData>(ingresar, {});
  const [estadoRegistro, accionRegistro, registrando] = useActionState<EstadoLogin, FormData>(registrarse, {});
  const esIngreso = modo === "ingresar";
  const estado = esIngreso ? estadoIngreso : estadoRegistro;
  const pendiente = esIngreso ? ingresando : registrando;

  return (
    <form action={esIngreso ? accionIngreso : accionRegistro} className="flex flex-col gap-4">
      <label className={etiqueta}>
        Email
        <input name="email" type="email" required autoComplete="email" className={campo} />
      </label>
      <label className={etiqueta}>
        Contraseña
        <input
          name="password"
          type="password"
          required
          minLength={esIngreso ? undefined : 8}
          autoComplete={esIngreso ? "current-password" : "new-password"}
          className={campo}
        />
      </label>
      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
      {estado.aviso && <p className="text-sm text-green-700 dark:text-green-400">{estado.aviso}</p>}
      <button type="submit" disabled={pendiente} className={boton}>
        {esIngreso ? "Ingresar" : "Crear cuenta"}
      </button>
      <button
        type="button"
        onClick={() => setModo(esIngreso ? "registrarse" : "ingresar")}
        className={`text-sm underline ${textoSuave}`}
      >
        {esIngreso ? "¿No tenés cuenta? Creala" : "Ya tengo cuenta"}
      </button>
    </form>
  );
}
