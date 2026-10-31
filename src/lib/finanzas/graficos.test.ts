import { describe, expect, it } from "vitest";
import { porcionesDeLaPrevision, rebanadas, SIN_SUBCATEGORIA, type CategoriaGrafico } from "./graficos";
import { calcularPrevision } from "./prevision";
import type { Cuenta, Datos, Movimiento } from "./tipos";

const banco: Cuenta = { id: "banco", nombre: "Banco", tipo: "banco", disponibilidad: "inmediata", saldoInicial: 0 };

const categorias: CategoriaGrafico[] = [
  { id: "canasta", nombre: "Canasta", icono: "🛒" },
  { id: "viveres", nombre: "Víveres", padreId: "canasta" },
  { id: "limpieza", nombre: "Limpieza", padreId: "canasta" },
  { id: "auto", nombre: "Auto" },
  { id: "sueldo", nombre: "Sueldo" },
];

const mov = (id: string, fecha: string, monto: number, categoriaId: string, extra: Partial<Movimiento> = {}) =>
  ({
    id,
    fecha,
    descripcion: id,
    tipo: "egreso",
    monto,
    cuentaId: "banco",
    categoria: categoriaId === "auto" ? "Auto" : "🛒 Canasta",
    categoriaId,
    estado: "real",
    origen: { tipo: "manual" },
    ...extra,
  }) as Movimiento;

function porciones(movimientos: Movimiento[]) {
  const datos: Datos = { cuentas: [banco], movimientos, planesCuotas: [], prestamos: [], recurrentes: [] };
  return porcionesDeLaPrevision(calcularPrevision(datos, { desde: "2026-10", meses: 2 }), categorias);
}

describe("gráficos de torta", () => {
  const lista = porciones([
    mov("super", "2026-10-05", 60_000_00, "viveres"),
    mov("ticket", "2026-10-06", 40_000_00, "viveres", {
      partes: [
        { categoriaId: "viveres", categoria: "🛒 Canasta", monto: 30_000_00 },
        { categoriaId: "limpieza", categoria: "🛒 Canasta", monto: 10_000_00 },
      ],
    }),
    mov("nafta", "2026-10-07", 20_000_00, "auto"),
    mov("varios", "2026-10-08", 5_000_00, "canasta"),
    mov("cobro", "2026-10-01", 500_000_00, "sueldo", { tipo: "ingreso", categoria: "Sueldo" }),
    mov("seguro", "2026-11-10", 15_000_00, "auto", { estado: "planificado" }),
  ]);

  it("por categoría principal, de mayor a menor", () => {
    expect(rebanadas(lista, { tipo: "gasto", desde: "2026-10", hasta: "2026-10" })).toEqual([
      { nombre: "🛒 Canasta", monto: 105_000_00, movimientos: 4, previsto: 0 },
      { nombre: "Auto", monto: 20_000_00, movimientos: 1, previsto: 0 },
    ]);
  });

  it("una categoría por sus subcategorías, con cada parte de un reparto en la suya", () => {
    const sub = rebanadas(lista, { tipo: "gasto", desde: "2026-10", hasta: "2026-10", categoria: "🛒 Canasta" });
    expect(sub.map((r) => [r.nombre, r.monto])).toEqual([
      ["Víveres", 90_000_00],
      ["Limpieza", 10_000_00],
      [SIN_SUBCATEGORIA, 5_000_00],
    ]);
  });

  it("los ingresos aparte, y lo previsto marcado", () => {
    expect(rebanadas(lista, { tipo: "ingreso", desde: "2026-10", hasta: "2026-11" })).toEqual([
      { nombre: "Sueldo", monto: 500_000_00, movimientos: 1, previsto: 0 },
    ]);
    expect(rebanadas(lista, { tipo: "gasto", desde: "2026-11", hasta: "2026-11" })).toEqual([
      { nombre: "Auto", monto: 15_000_00, movimientos: 1, previsto: 15_000_00 },
    ]);
  });

  it("más de ocho rebanadas: las chicas se juntan en Otros", () => {
    const muchas = Array.from({ length: 10 }, (_, i) => ({
      mes: "2026-10",
      tipo: "gasto" as const,
      categoria: `C${i}`,
      subcategoria: SIN_SUBCATEGORIA,
      monto: (10 - i) * 100,
      movimientos: 1,
      previsto: 0,
    }));
    const r = rebanadas(muchas, { tipo: "gasto", desde: "2026-10", hasta: "2026-10" });
    expect(r).toHaveLength(8);
    expect(r[7]).toMatchObject({ nombre: "Otros", monto: 300 + 200 + 100, incluye: ["C7", "C8", "C9"] });
  });
});
