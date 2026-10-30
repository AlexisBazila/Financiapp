"use server";

import { revalidatePath } from "next/cache";
import { categoriaElegida } from "@/lib/datos/categoria-elegida";
import { pesosACentavos, texto } from "@/lib/datos/formularios";
import type { Movimiento, Origen } from "@/lib/finanzas/tipos";
import { requerirUsuario } from "@/lib/supabase/servidor";

export interface Resultado {
  error?: string;
  ok?: boolean;
}

/**
 * Qué se está guardando: un movimiento ya cargado (`id`), uno generado por una cuota o un recurrente
 * que todavía no se cargó (`origen`), o uno nuevo (nada).
 */
export interface Base {
  id?: string;
  origen?: Origen;
  mesResumen?: string;
}

function mensaje(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Ese movimiento ya estaba cargado; recargá la página.";
  return `No se pudo guardar: ${error.message}`;
}

export async function guardarMovimiento(base: Base | null, _: Resultado, form: FormData): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const tipoElegido = texto(form, "tipo");
  // Un pago de tarjeta se guarda como transferencia de una cuenta a la tarjeta.
  const pagoDeTarjeta = tipoElegido === "pago_tarjeta";
  const tipo = pagoDeTarjeta ? "transferencia" : tipoElegido;
  const fecha = texto(form, "fecha");
  const monto = pesosACentavos(texto(form, "monto"));
  const cuentaId = texto(form, "cuenta_id");
  const destinoId = texto(form, "cuenta_destino_id");
  const estado = texto(form, "estado");

  if (!["ingreso", "egreso", "transferencia"].includes(tipo)) return { error: "Elegí el tipo." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Elegí la fecha." };
  if (!monto || monto <= 0) return { error: "El monto tiene que ser un número mayor a cero." };
  if (!cuentaId) return { error: "Elegí la cuenta." };
  if (tipo === "transferencia" && (!destinoId || destinoId === cuentaId)) {
    return { error: "Elegí una cuenta destino distinta de la de origen." };
  }
  if (!["real", "planificado"].includes(estado)) return { error: "Elegí si ya pasó o es planificado." };
  if (pagoDeTarjeta) {
    const { data } = await supabase.from("cuentas").select("id, tipo").in("id", [cuentaId, destinoId]);
    const tipoDe = (id: string) => data?.find((c) => c.id === id)?.tipo;
    if (tipoDe(destinoId) !== "tarjeta") return { error: "Elegí la tarjeta que pagás." };
    if (tipoDe(cuentaId) === "tarjeta") return { error: "Elegí la cuenta desde la que pagás." };
  }
  const categoria =
    tipo === "transferencia"
      ? { categoria_id: null, categoria: null }
      : await categoriaElegida(supabase, form, tipo === "ingreso" ? "ingreso" : "egreso");
  if ("error" in categoria) return categoria;

  const fila = {
    tipo,
    fecha,
    monto,
    cuenta_id: cuentaId,
    cuenta_destino_id: tipo === "transferencia" ? destinoId : null,
    ...categoria,
    descripcion: texto(form, "descripcion") || (pagoDeTarjeta ? "Pago de tarjeta" : ""),
    contraparte: tipo === "transferencia" ? null : texto(form, "contraparte").slice(0, 80) || null,
    estado,
    // En otra moneda solo gastos e ingresos (por ejemplo, una compra en dólares con la tarjeta).
    moneda: tipo !== "transferencia" && texto(form, "moneda") === "USD" ? "USD" : null,
    // Lo que no pasó todavía no puede estar conciliado.
    conciliado: estado === "real" && form.get("conciliado") === "on",
  };
  const { error } = base?.id
    ? await supabase.from("movimientos").update(fila).eq("id", base.id)
    : await supabase
        .from("movimientos")
        .insert({ ...fila, origen: base?.origen ?? { tipo: "manual" }, mes_resumen: base?.mesResumen ?? null });
  if (error) return { error: mensaje(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Confirma un movimiento (pasa a real) o cambia su conciliación. Si es una cuota o un recurrente que
 * todavía no se cargó, lo guarda.
 */
export async function marcar(mov: Movimiento, guardado: boolean, cambio: { conciliado?: boolean }) {
  const { supabase } = await requerirUsuario();
  const marcas = { estado: "real", ...(cambio.conciliado === undefined ? {} : { conciliado: cambio.conciliado }) };
  const { error } = guardado
    ? await supabase.from("movimientos").update(marcas).eq("id", mov.id)
    : await supabase.from("movimientos").insert({
        fecha: mov.fecha,
        descripcion: mov.descripcion,
        tipo: mov.tipo,
        monto: mov.monto,
        cuenta_id: mov.cuentaId,
        cuenta_destino_id: mov.cuentaDestinoId ?? null,
        categoria: mov.categoria ?? null,
        categoria_id: mov.categoriaId ?? null,
        contraparte: mov.contraparte ?? null,
        origen: mov.origen,
        mes_resumen: mov.mesResumen ?? null,
        ...marcas,
      });
  if (error) throw new Error(mensaje(error));
  revalidatePath("/", "layout");
}

export async function borrarMovimiento(id: string) {
  const { supabase } = await requerirUsuario();
  const { error } = await supabase.from("movimientos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
