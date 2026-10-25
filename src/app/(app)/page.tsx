import Link from "next/link";
import { cargarHogar } from "@/lib/datos/cargar";
import { hoy, mesDe, mesesEntre, nombreMes } from "@/lib/finanzas/fechas";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { boton, textoSuave } from "../estilos";
import { VistaPrevision } from "../vista-prevision";

const MESES_ADELANTE = 12;

export default async function Prevision() {
  const { supabase } = await requerirUsuario();
  const { hogar, datos, escenarios } = await cargarHogar(supabase);

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

  const mesActual = mesDe(hoy());
  const desde = hogar.mesInicio;
  const visibleDesde = mesActual > desde ? mesActual : desde;
  const meses = mesesEntre(desde, visibleDesde) + MESES_ADELANTE;

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Previsión</h1>
      <VistaPrevision datos={datos} escenarios={escenarios} desde={desde} meses={meses} visibleDesde={visibleDesde} />
    </>
  );
}
