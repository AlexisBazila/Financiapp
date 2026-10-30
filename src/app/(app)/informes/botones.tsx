"use client";

import { useState } from "react";
import { boton, botonSecundario } from "../../estilos";

/** Descargar el informe en PDF (con la impresión del navegador) o CSV, o copiarlo como texto para una IA. */
export function BotonesInforme({ csv, texto }: { csv: string; texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className={boton}>
        Descargar PDF
      </button>
      <a href={csv} className={botonSecundario} download>
        Descargar CSV
      </a>
      <button
        type="button"
        className={botonSecundario}
        onClick={() =>
          navigator.clipboard.writeText(texto).then(() => {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
          })
        }
      >
        {copiado ? "¡Copiado!" : "Copiar texto para una IA"}
      </button>
    </div>
  );
}
