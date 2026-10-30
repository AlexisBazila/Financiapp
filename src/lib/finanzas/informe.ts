// Informe resumido de las finanzas del hogar, pensado para pasárselo a una IA (o a una persona) y
// pedirle ayuda para decidir: cuánto se puede invertir, qué cuota se puede pagar, dónde recortar.
// Se arma como tablas simples que después se muestran en pantalla, en PDF, en CSV o como texto.

import { expandir, calcularPrevision, type MesPrevision } from "./prevision";
import { mesDe, mesesEntre, sumarMeses } from "./fechas";
import type { Centavos, Datos, Fecha, Mes, Movimiento } from "./tipos";

export const SECCIONES = {
  gastos: "Gastos por categoría",
  ingresos: "Ingresos por categoría",
  presupuestos: "Presupuestos",
  deudas: "Deudas",
  cuotas: "Cuotas y préstamos",
  cuentas: "Cuentas y patrimonio",
} as const;

export type Seccion = keyof typeof SECCIONES;

export const esSeccion = (s: string): s is Seccion => Object.hasOwn(SECCIONES, s);

export type Celda = string | number;

export interface Tabla {
  titulo: string;
  /** Qué significa la tabla, para quien la lee sin conocer la app. */
  nota: string;
  columnas: string[];
  filas: Celda[][];
}

export interface Informe {
  titulo: string;
  generado: Fecha;
  desde: Mes;
  hasta: Mes;
  mesActual: Mes;
  /** Contexto y aclaraciones generales. */
  notas: string[];
  tablas: Tabla[];
  /** Preguntas de ejemplo para hacerle a una IA con el informe. */
  preguntas: string[];
}

export interface OpcionesInforme {
  hoy: Fecha;
  /** Mes desde el que se pueden calcular saldos (el de los saldos iniciales). */
  mesInicio: Mes;
  /** Meses cerrados hacia atrás, sin contar el actual. */
  atras: number;
  /** Meses de previsión hacia adelante, sin contar el actual. */
  adelante: number;
  incluir: Seccion[];
  /** Nombre de cada categoría por id, para presupuestos. */
  categorias?: Record<string, string>;
}

/** Centavos a pesos con dos decimales, como número: así los lee bien una planilla o una IA. */
const $ = (c: Centavos) => Math.round(c) / 100;

const NOMBRES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "octubre 2026". */
const etiquetaMes = (mes: Mes) => {
  const [anio, m] = mes.split("-").map(Number);
  return `${NOMBRES[m - 1]} ${anio}`;
};

/** Tipo de dato de cada mes respecto de hoy. */
const certeza = (mes: Mes, actual: Mes) => (mes < actual ? "real" : mes === actual ? "en curso" : "previsto");

const promedio = (valores: number[]) =>
  valores.length ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 100) / 100 : 0;

/** Tabla de categorías por mes, con el promedio de los meses reales (o de todos, si no hay). */
function porCategoria(meses: MesPrevision[], actual: Mes, campo: "egresosPorCategoria" | "ingresosPorCategoria") {
  const categorias = [...new Set(meses.flatMap((m) => Object.keys(m[campo])))];
  const reales = meses.filter((m) => m.mes < actual);
  const base = reales.length ? reales : meses;
  const filas = categorias
    .map((cat) => [cat, ...meses.map((m) => $(m[campo][cat] ?? 0)), promedio(base.map((m) => $(m[campo][cat] ?? 0)))])
    .sort((a, b) => Number(b[b.length - 1]) - Number(a[a.length - 1]));
  const totales = ["TOTAL", ...meses.map((m) => $(Object.values(m[campo]).reduce((s, v) => s + v, 0)))];
  totales.push(promedio(base.map((m) => $(Object.values(m[campo]).reduce((s, v) => s + v, 0)))));
  return {
    columnas: [
      "Categoría",
      ...meses.map((m) => `${etiquetaMes(m.mes)} (${certeza(m.mes, actual)})`),
      "Promedio mensual",
    ],
    filas: [...filas, totales],
    promedioDe: reales.length ? "los meses reales" : "todos los meses del informe",
  };
}

/** Cuotas que todavía no se pagaron, agrupadas por compra, préstamo o deuda. */
function pendientesPorOrigen(datos: Datos, desde: Mes, hasta: Mes, tipos: Movimiento["origen"]["tipo"][]) {
  const grupos = new Map<string, Movimiento[]>();
  for (const m of expandir(datos, desde, hasta)) {
    if (!tipos.includes(m.origen.tipo) || m.estado === "real") continue;
    const o = m.origen as { tipo: string; planId?: string; prestamoId?: string; deudaId?: string };
    const clave = `${o.tipo}:${o.planId ?? o.prestamoId ?? o.deudaId}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), m]);
  }
  return [...grupos.values()].map((lista) => lista.sort((a, b) => a.fecha.localeCompare(b.fecha)));
}

const sinNumeroDeCuota = (descripcion: string) => descripcion.replace(/\s*\(\d+\/\d+\)\s*$/, "");

export function armarInforme(datos: Datos, opciones: OpcionesInforme): Informe {
  const actual = mesDe(opciones.hoy);
  const desde = [sumarMeses(actual, -opciones.atras), opciones.mesInicio].sort().at(-1)!;
  const hasta = sumarMeses(actual, opciones.adelante);
  const calculables = desde >= opciones.mesInicio ? mesesEntre(opciones.mesInicio, hasta) + 1 : 0;
  const prevision = calcularPrevision(datos, {
    desde: opciones.mesInicio,
    meses: Math.max(1, calculables),
    mesActual: actual,
    hoy: opciones.hoy,
  });
  const meses = prevision.filter((m) => m.mes >= desde && m.mes <= hasta);
  const delMesActual = prevision.find((m) => m.mes === actual) ?? meses[0];
  const incluir = new Set(opciones.incluir);
  const tablas: Tabla[] = [];

  tablas.push({
    titulo: "Resumen mensual",
    nota: "Ingresos y gastos de cada mes. Los meses 'real' ya pasaron; 'en curso' mezcla lo cargado con lo que falta según el plan; 'previsto' es la proyección con gastos fijos, cuotas, presupuestos y recurrentes. Gastos con tarjeta: cuentan en el mes en que cierra el resumen. 'Plata que sale' suma los gastos de las cuentas y el resumen de tarjeta que vence en el mes. 'Resto' es lo que sobra (o falta) acumulado después de apartar el ahorro.",
    columnas: [
      "Mes",
      "Tipo",
      "Ingresos",
      "Gastos",
      "Ingresos − gastos",
      "Plata que sale",
      "Ahorro e inversión",
      "Cuotas del mes",
      "Resto acumulado",
    ],
    filas: meses.map((m) => [
      etiquetaMes(m.mes),
      certeza(m.mes, actual),
      $(m.ingresos),
      $(m.egresos),
      $(m.neto),
      $(m.gastosDelMes),
      $(m.ahorroDelMes),
      $(m.cuotasDelMes),
      $(m.resto),
    ]),
  });

  if (incluir.has("gastos")) {
    const t = porCategoria(meses, actual, "egresosPorCategoria");
    tablas.push({
      titulo: SECCIONES.gastos,
      nota: `Gasto de cada categoría principal por mes (débito, efectivo y tarjeta). El promedio es de ${t.promedioDe}.`,
      columnas: t.columnas,
      filas: t.filas,
    });
  }

  if (incluir.has("ingresos")) {
    const t = porCategoria(meses, actual, "ingresosPorCategoria");
    tablas.push({
      titulo: SECCIONES.ingresos,
      nota: `Ingresos de cada categoría por mes. El promedio es de ${t.promedioDe}.`,
      columnas: t.columnas,
      filas: t.filas,
    });
  }

  if (incluir.has("presupuestos") && delMesActual) {
    const definidos = new Map((datos.presupuestos ?? []).map((p) => [p.id, p]));
    tablas.push({
      titulo: SECCIONES.presupuestos,
      nota: `Topes de gasto del mes actual (${etiquetaMes(actual)}) y cuánto se usó. 'Resto' negativo: se pasó.`,
      columnas: ["Presupuesto", "Categorías", "Cada cuántos meses", "Monto del mes", "Gastado", "Resto"],
      filas: delMesActual.presupuestos.map((p) => {
        const def = definidos.get(p.id);
        const cats = (def?.categoriaIds ?? []).map((id) => opciones.categorias?.[id]).filter(Boolean);
        return [
          p.nombre,
          [...new Set(cats)].join(" / ") || "—",
          String(def?.cadaMeses ?? 1),
          $(p.monto),
          $(p.gastado),
          $(p.resto),
        ];
      }),
    });
  }

  // Las cuotas y deudas se miran hasta 10 años adelante, para ver cuándo terminan.
  const lejos = sumarMeses(actual, 120);
  if (incluir.has("cuotas")) {
    const grupos = pendientesPorOrigen(datos, actual, lejos, ["cuotas", "prestamo"]);
    const filas = grupos.map((lista) => {
      const primera = lista[0];
      const o = primera.origen as { tipo: string; total: number };
      return [
        sinNumeroDeCuota(primera.descripcion),
        o.tipo === "prestamo" ? "préstamo" : "compra en cuotas",
        $(primera.monto),
        String(lista.length),
        String(o.total),
        $(lista.reduce((s, m) => s + m.monto, 0)),
        etiquetaMes(mesDe(primera.fecha)),
        etiquetaMes(mesDe(lista[lista.length - 1].fecha)),
      ];
    });
    filas.push([
      "TOTAL",
      "",
      $(grupos.reduce((s, l) => s + (mesDe(l[0].fecha) === actual ? l[0].monto : 0), 0)),
      "",
      "",
      $(grupos.reduce((s, l) => s + l.reduce((t, m) => t + m.monto, 0), 0)),
      "",
      "",
    ]);
    tablas.push({
      titulo: SECCIONES.cuotas,
      nota: "Compras en cuotas y préstamos con cuotas sin pagar desde este mes. En el total, la columna de cuota suma solo las cuotas de este mes.",
      columnas: [
        "Concepto",
        "Tipo",
        "Cuota",
        "Cuotas que faltan",
        "Cuotas en total",
        "Falta pagar",
        "Próxima",
        "Última",
      ],
      filas,
    });
  }

  if (incluir.has("deudas")) {
    const grupos = pendientesPorOrigen(datos, sumarMeses(opciones.mesInicio, -1), lejos, ["deuda"]);
    const filas = grupos.map((lista) => [
      sinNumeroDeCuota(lista[0].descripcion),
      String(lista.length),
      $(lista.reduce((s, m) => s + m.monto, 0)),
      etiquetaMes(mesDe(lista[0].fecha)),
      etiquetaMes(mesDe(lista[lista.length - 1].fecha)),
    ]);
    filas.push(["TOTAL", "", $(grupos.reduce((s, l) => s + l.reduce((t, m) => t + m.monto, 0), 0)), "", ""]);
    tablas.push({
      titulo: SECCIONES.deudas,
      nota: "Deudas en cuotas que se pagan cuando conviene (por ejemplo, impuestos atrasados): cuotas sin pagar y en qué mes se planea pagarlas.",
      columnas: ["Deuda", "Cuotas sin pagar", "Falta pagar", "Primera planeada", "Última planeada"],
      filas,
    });
  }

  if (incluir.has("cuentas") && delMesActual) {
    const nombres: Record<string, string> = {
      efectivo: "efectivo",
      banco: "banco",
      billetera: "billetera virtual",
      inversion: "inversión",
      tarjeta: "tarjeta de crédito",
    };
    const filas: Celda[][] = datos.cuentas.map((c) => {
      // En las tarjetas el saldo es la deuda: va en negativo.
      const saldo = (delMesActual.saldos[c.id] ?? 0) * (c.tarjeta ? -1 : 1);
      return [c.nombre, nombres[c.tipo] ?? c.tipo, c.moneda ?? "ARS", $(saldo), $(saldo * (c.cambio ?? 1))];
    });
    const m = delMesActual;
    filas.push(
      ["Disponible para gastar", "", "ARS", "", $(m.disponible)],
      ["No inmediato (inversiones, otra moneda)", "", "ARS", "", $(m.disponible48h)],
      ["Reserva de ahorro", "", "ARS", "", $(m.reserva)],
      ["Deuda de tarjetas", "", "ARS", "", $(-m.deudaTarjetas)],
      ["Cuotas que faltan pagar", "", "ARS", "", $(-m.cuotasFuturas)],
      [
        "PATRIMONIO NETO",
        "",
        "ARS",
        "",
        $(m.disponible + m.disponible48h + m.reserva - m.deudaTarjetas - m.cuotasFuturas),
      ],
    );
    tablas.push({
      titulo: SECCIONES.cuentas,
      nota: `Saldos previstos al cierre de ${etiquetaMes(actual)}. En tarjetas, el saldo es lo que se debe (va en negativo en pesos).`,
      columnas: ["Cuenta", "Tipo", "Moneda", "Saldo en su moneda", "En pesos"],
      filas,
    });
  }

  return {
    titulo: "Informe de finanzas del hogar",
    generado: opciones.hoy,
    desde,
    hasta,
    mesActual: actual,
    notas: [
      `Generado el ${opciones.hoy} con Financiapp. Período: ${etiquetaMes(desde)} a ${etiquetaMes(hasta)}; el mes actual es ${etiquetaMes(actual)}.`,
      "Montos en pesos argentinos (ARS), con dos decimales. Lo que está en otra moneda se pasó a pesos con la cotización del día.",
      "Los meses pasados son datos reales cargados; los futuros son una previsión según el plan (sueldos, gastos fijos, cuotas, presupuestos).",
      "Argentina tiene inflación alta: los montos de meses distintos no son del todo comparables.",
    ],
    tablas,
    preguntas: [
      "Con estos datos, ¿cuánto podría destinar por mes a la remodelación de la casa sin quedar en negativo?",
      "¿Cuál sería la cuota máxima razonable para un auto, y en qué mes conviene empezar a pagarla?",
      "¿En qué categorías estoy gastando más de lo habitual y dónde podría recortar?",
      "¿Mis presupuestos son realistas comparados con lo que gasto en promedio?",
    ],
  };
}

const textoCelda = (c: Celda) => (typeof c === "number" ? c.toFixed(2) : c);

/** CSV con una tabla tras otra (título, columnas y filas, separadas por una línea vacía). */
export function informeACSV(informe: Informe): string {
  const campo = (c: Celda) => {
    const t = typeof c === "number" ? c.toFixed(2) : c;
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lineas = [campo(informe.titulo), ...informe.notas.map(campo), ""];
  for (const t of informe.tablas) {
    lineas.push(campo(t.titulo), campo(t.nota), t.columnas.map(campo).join(","));
    for (const f of t.filas) lineas.push(f.map(campo).join(","));
    lineas.push("");
  }
  // BOM para que Excel lo abra con tildes.
  return "﻿" + lineas.join("\r\n");
}

/** Texto en Markdown, para pegar en un chat con una IA. */
export function informeAMarkdown(informe: Informe): string {
  const partes = [`# ${informe.titulo}`, "", ...informe.notas.map((n) => `- ${n}`), ""];
  for (const t of informe.tablas) {
    partes.push(`## ${t.titulo}`, "", t.nota, "");
    partes.push(`| ${t.columnas.join(" | ")} |`, `| ${t.columnas.map(() => "---").join(" | ")} |`);
    for (const f of t.filas) partes.push(`| ${f.map((c) => String(textoCelda(c)).replace(/\|/g, "/")).join(" | ")} |`);
    partes.push("");
  }
  partes.push("## Preguntas para analizar", "", ...informe.preguntas.map((p) => `- ${p}`), "");
  return partes.join("\n");
}
