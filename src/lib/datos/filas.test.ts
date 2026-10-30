import { describe, expect, it } from "vitest";
import { aMovimiento, type FilaMovimiento } from "./filas";

const fila: FilaMovimiento = {
  id: "m",
  fecha: "2026-10-30",
  descripcion: "Netflix",
  tipo: "egreso",
  monto: 12_99,
  cuenta_id: "visa",
  cuenta_destino_id: null,
  categoria: null,
  categoria_id: null,
  contraparte: null,
  estado: "real",
  origen: { tipo: "manual" },
  mes_resumen: null,
  conciliado: false,
};

describe("movimientos en otra moneda", () => {
  it("pasan a pesos con la cotización del día y guardan el monto original", () => {
    const m = aMovimiento({ ...fila, moneda: "USD" }, { USD: 1450.5 });
    expect(m.monto).toBe(Math.round(12_99 * 1450.5));
    expect(m.original).toEqual({ moneda: "USD", monto: 12_99 });
  });

  it("en pesos quedan igual", () => {
    const m = aMovimiento(fila, { USD: 1450.5 });
    expect(m.monto).toBe(12_99);
    expect(m.original).toBeUndefined();
  });

  it("con reparto, convierten cada parte y siguen sumando el total", () => {
    const reparto = [
      { categoria_id: "comida", monto: 3_33 },
      { categoria_id: "limpieza", monto: 3_33 },
      { categoria_id: "otros", monto: 3_33 },
    ];
    const m = aMovimiento({ ...fila, monto: 9_99, moneda: "USD", reparto }, { USD: 1450.37 });
    expect(m.partes?.reduce((s, p) => s + p.monto, 0)).toBe(m.monto);
    expect(m.partes?.map((p) => p.original)).toEqual([3_33, 3_33, 3_33]);
  });
});
