import { fechaEnMes, mesDe, sumarMeses } from "./fechas";
import type { CicloTarjeta, Cuenta, Fecha, Mes } from "./tipos";

/** Cierre y vencimiento del resumen de un mes: el cargado, o el habitual si no hay. */
export function cicloDe(cuenta: Cuenta, mes: Mes): CicloTarjeta {
  const config = cuenta.tarjeta;
  if (!config) throw new Error(`La cuenta ${cuenta.id} no es una tarjeta`);
  const cargado = config.ciclos.find((c) => c.mes === mes);
  if (cargado) return cargado;
  return {
    mes,
    cierre: fechaEnMes(mes, config.diaCierre),
    vencimiento: fechaEnMes(sumarMeses(mes, 1), config.diaVencimiento),
  };
}

/**
 * Resumen en el que entra una compra hecha en `fecha`:
 * el primer resumen cuyo cierre es igual o posterior a la compra.
 */
export function resumenDeFecha(cuenta: Cuenta, fecha: Fecha): Mes {
  const mes = mesDe(fecha);
  for (const candidato of [sumarMeses(mes, -1), mes, sumarMeses(mes, 1)]) {
    if (fecha <= cicloDe(cuenta, candidato).cierre) return candidato;
  }
  return sumarMeses(mes, 2);
}
