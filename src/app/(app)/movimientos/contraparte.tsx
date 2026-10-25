import { useId } from "react";
import { campo, etiqueta } from "../../estilos";

/** Comercio, persona o cuenta del otro lado del movimiento, con los ya usados como sugerencia. */
export function CampoContraparte({
  sugerencias,
  tipo = "egreso",
  valorInicial,
}: {
  sugerencias: string[];
  tipo?: "ingreso" | "egreso";
  valorInicial?: string;
}) {
  const lista = useId();
  return (
    <label className={etiqueta}>
      {tipo === "ingreso" ? "Cobrado de (opcional)" : "Pagado a (opcional)"}
      <input
        name="contraparte"
        list={lista}
        maxLength={80}
        autoComplete="off"
        defaultValue={valorInicial}
        placeholder={tipo === "ingreso" ? "Ej.: cliente o empresa" : "Ej.: Bercomat"}
        className={campo}
      />
      <datalist id={lista}>
        {sugerencias.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </label>
  );
}
