import { arbol, etiqueta, type Categoria, type TipoCategoria } from "@/lib/datos/categorias";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { cargarHogar } from "@/lib/datos/cargar";
import { caja, textoSuave } from "../../estilos";
import { EditarCategoria, FormularioCategoria } from "./formularios";
import { Punto } from "./selector";

function Lista({ categorias, tipo }: { categorias: Categoria[]; tipo: TipoCategoria }) {
  const ramas = arbol(categorias, tipo, { archivadas: true });
  const principales = ramas.map((r) => r.categoria).filter((c) => !c.archivada);
  const titulo = tipo === "egreso" ? "Gastos" : "Ingresos";

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <ul className={`${caja} divide-y divide-black/5 dark:divide-white/10`}>
        {ramas.map(({ categoria, hijas }) => (
          <li key={categoria.id} className={`px-4 py-3 ${categoria.archivada ? "opacity-50" : ""}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Punto color={categoria.color} />
              <span className="flex-1 font-medium">
                {etiqueta(categoria)}
                {categoria.archivada && <span className={`ml-2 text-xs font-normal ${textoSuave}`}>archivada</span>}
              </span>
              <EditarCategoria categoria={categoria} principales={principales} />
            </div>
            {hijas.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 border-l-2 pl-4" style={{ borderColor: categoria.color }}>
                {hijas.map((h) => (
                  <li
                    key={h.id}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${h.archivada ? "opacity-50" : ""}`}
                  >
                    {h.color !== categoria.color && <Punto color={h.color} />}
                    <span className="flex-1">
                      {etiqueta(h)}
                      {h.archivada && <span className={`ml-2 text-xs ${textoSuave}`}>archivada</span>}
                    </span>
                    <EditarCategoria categoria={h} principales={principales} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <details className={`${caja} p-5`}>
        <summary className="cursor-pointer text-sm font-medium">
          Nueva categoría de {titulo.toLowerCase()}
        </summary>
        <div className="mt-4">
          <FormularioCategoria tipo={tipo} principales={principales} />
        </div>
      </details>
    </section>
  );
}

export default async function Categorias() {
  const { supabase } = await requerirUsuario();
  const { categorias } = await cargarHogar(supabase);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Categorías</h1>
        <p className={`mt-1 text-sm ${textoSuave}`}>
          La previsión suma por categoría principal; las subcategorías son para el detalle. Ahorrar, invertir y pagar
          la tarjeta no son gastos: cargalos como movimiento entre cuentas.
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <Lista categorias={categorias} tipo="egreso" />
        <Lista categorias={categorias} tipo="ingreso" />
      </div>
    </div>
  );
}
