import { describe, expect, it } from "vitest";
import { armarInforme, informeACSV, informeAMarkdown } from "./informe";
import type { Cuenta, Datos, Movimiento } from "./tipos";

const banco: Cuenta = {
  id: "banco",
  nombre: "Banco",
  tipo: "banco",
  disponibilidad: "inmediata",
  saldoInicial: 100_000_00,
};

const mov = (id: string, fecha: string, tipo: Movimiento["tipo"], monto: number, categoria: string): Movimiento => ({
  id,
  fecha,
  descripcion: id,
  tipo,
  monto,
  cuentaId: "banco",
  categoria,
  estado: "real",
  origen: { tipo: "manual" },
});

const datos: Datos = {
  cuentas: [banco],
  movimientos: [
    mov("sueldo", "2026-09-01", "ingreso", 500_000_00, "Sueldo"),
    mov("super", "2026-09-10", "egreso", 120_000_00, "Alimentos"),
    mov("sueldo2", "2026-10-01", "ingreso", 500_000_00, "Sueldo"),
    mov("super2", "2026-10-10", "egreso", 80_000_00, "Alimentos"),
  ],
  planesCuotas: [
    {
      id: "tele",
      descripcion: "Tele",
      categoria: "Hogar",
      cuentaId: "banco",
      fechaCompra: "2026-10-05",
      montoTotal: 300_000_00,
      cantidad: 3,
    },
  ],
  prestamos: [],
  recurrentes: [],
};

describe("informe", () => {
  const informe = armarInforme(datos, {
    hoy: "2026-10-30",
    mesInicio: "2026-09",
    atras: 6,
    adelante: 2,
    incluir: ["gastos", "cuotas", "cuentas"],
  });

  it("arranca en el mes de inicio aunque se pidan más meses atrás", () => {
    expect(informe.desde).toBe("2026-09");
    expect(informe.hasta).toBe("2026-12");
    expect(informe.tablas[0].filas.map((f) => f[1])).toEqual(["real", "en curso", "previsto", "previsto"]);
  });

  it("promedia los gastos de los meses reales", () => {
    const gastos = informe.tablas.find((t) => t.titulo === "Gastos por categoría")!;
    const alimentos = gastos.filas.find((f) => f[0] === "Alimentos")!;
    expect(alimentos.at(-1)).toBe(120_000);
  });

  it("lista las cuotas que faltan", () => {
    const cuotas = informe.tablas.find((t) => t.titulo === "Cuotas y préstamos")!;
    expect(cuotas.filas[0]).toEqual([
      "Tele",
      "compra en cuotas",
      100_000,
      "3",
      "3",
      300_000,
      "octubre 2026",
      "diciembre 2026",
    ]);
  });

  it("se exporta a CSV y Markdown", () => {
    expect(informeACSV(informe)).toContain("Resumen mensual");
    expect(informeAMarkdown(informe)).toContain("| Mes | Tipo |");
  });
});
