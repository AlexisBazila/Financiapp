import { fechaEnMes, sumarMeses } from "./fechas";
import type { Centavos, Fecha, Mes, Movimiento, Recurrente } from "./tipos";

/**
 * Crea la ocurrencia de cada mes de un recurrente, salvo los meses que ya tienen
 * un movimiento con ese origen (porque lo confirmaste o lo cargaste a mano).
 */
export function instanciarRecurrente(
  recurrente: Recurrente,
  existentes: Movimiento[],
  desde: Mes,
  hasta: Mes,
): Movimiento[] {
  const yaCargados = new Set(
    existentes.flatMap((m) =>
      m.origen.tipo === "recurrente" && m.origen.recurrenteId === recurrente.id ? [m.origen.mes] : [],
    ),
  );
  const inicio = recurrente.desde > desde ? recurrente.desde : desde;
  const fin = recurrente.hasta && recurrente.hasta < hasta ? recurrente.hasta : hasta;

  const resultado: Movimiento[] = [];
  for (let mes = inicio; mes <= fin; mes = sumarMeses(mes, 1)) {
    if (yaCargados.has(mes)) continue;
    resultado.push({
      id: `${recurrente.id}@${mes}`,
      fecha: fechaEnMes(mes, recurrente.diaDelMes),
      descripcion: recurrente.descripcion,
      tipo: recurrente.tipo,
      monto: recurrente.montoEstimado,
      cuentaId: recurrente.cuentaId,
      categoria: recurrente.categoria,
      categoriaId: recurrente.categoriaId,
      contraparte: recurrente.contraparte,
      estado: recurrente.requiereConfirmacion ? "pendiente" : "planificado",
      origen: { tipo: "recurrente", recurrenteId: recurrente.id, mes },
    });
  }
  return resultado;
}

/** Convierte una ocurrencia pendiente en un movimiento real, con el monto que efectivamente entró. */
export function confirmar(pendiente: Movimiento, montoReal: Centavos, fechaReal?: Fecha): Movimiento {
  if (pendiente.origen.tipo !== "recurrente") throw new Error("Solo se confirman ocurrencias de recurrentes");
  return {
    ...pendiente,
    id: `${pendiente.id}:real`,
    monto: montoReal,
    fecha: fechaReal ?? pendiente.fecha,
    estado: "real",
  };
}
