import Link from "next/link";
import { cargarHogar } from "@/lib/datos/cargar";
import { etiqueta } from "@/lib/datos/categorias";
import { hoy, mesDe, mesesEntre, nombreMes } from "@/lib/finanzas/fechas";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { boton, textoSuave } from "../estilos";
import { VistaPrevision } from "../vista-prevision";
import { NuevoMovimiento } from "./movimientos/formularios";
import { movimientosDelMes } from "./movimientos/opciones";

const MESES_ADELANTE = 12;

export default async function Prevision() {
  const { supabase } = await requerirUsuario();
  const datosHogar = await cargarHogar(supabase);
  const { hogar, datos, escenarios, categorias } = datosHogar;
  const subcategorias = Object.fromEntries(categorias.filter((c) => c.padreId).map((c) => [c.id, etiqueta(c)]));

  if (datos.cuentas.length === 0) {
    return (
      <div className="flex max-w-lg flex-col items-start gap-4">
        <h1 className="text-2xl font-semibold">Empecemos por tus cuentas</h1>
        <p className={textoSuave}>
          Cargá tus cuentas (banco, efectivo, tarjetas, ahorro e inversiones) con el saldo que tenían el 1 de{" "}
          {nombreMes(hogar.mesInicio)}. A partir de ahí la app arma la previsión mes a mes.
        </p>
        <Link href="/cuentas" className={boton}>
          Cargar cuentas
        </Link>
      </div>
    );
  }

  const fecha = hoy();
  const mesActual = mesDe(fecha);
  const desde = hogar.mesInicio;
  const visibleDesde = mesActual > desde ? mesActual : desde;
  const meses = mesesEntre(desde, visibleDesde) + MESES_ADELANTE;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Previsión</h1>
        <NuevoMovimiento
          {...movimientosDelMes(datosHogar, mesActual, mesActual).opciones}
          fechaSugerida={fecha}
          rapido
        />
      </div>
      <VistaPrevision
        datos={datos}
        escenarios={escenarios}
        desde={desde}
        meses={meses}
        visibleDesde={visibleDesde}
        mesActual={mesActual}
        hoy={fecha}
        subcategorias={subcategorias}
      />
    </>
  );
}
