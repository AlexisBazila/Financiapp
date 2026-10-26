import { describe, expect, it } from "vitest";
import { leerCuotas, pesosACentavos } from "./formularios";

describe("pesosACentavos", () => {
  it.each([
    ["100000", 100_000_00],
    ["100.000", 100_000_00],
    ["$ 1.234.567,89", 1_234_567_89],
    ["64150,83", 64_150_83],
    ["64150.83", 64_150_83],
    ["1234.5", 1_234_50],
  ])("%s", (entrada, esperado) => {
    expect(pesosACentavos(entrada)).toBe(esperado);
  });

  it("rechaza lo que no es un número", () => {
    expect(pesosACentavos("")).toBeNull();
    expect(pesosACentavos("abc")).toBeNull();
    expect(pesosACentavos("1,2,3")).toBeNull();
  });
});

describe("leerCuotas", () => {
  it("toma el vencimiento y el total de cada fila de la tabla del banco", () => {
    const tabla = [
      "Concepto\tVencimiento\tIPA CAPITAL\tBonificaciones\tCap. Fe. 1\tIntereses\tTotal a pagar",
      "CUOTA\t10/03/2026\t22.372,00\t0,00\t2.237,20\t8.048,56\t32.657,76",
      "CUOTA 10/04/2026 22.372,00 0,00 2.237,20 6.583,49 31.192,69",
    ].join("\n");
    expect(leerCuotas(tabla)).toEqual([
      { monto: 32_657_76, vencimiento: "2026-03-10" },
      { monto: 31_192_69, vencimiento: "2026-04-10" },
    ]);
  });

  it("acepta solo montos, uno por línea", () => {
    expect(leerCuotas("25.905,81\n\n$ 27.554,37\n")).toEqual([{ monto: 25_905_81 }, { monto: 27_554_37 }]);
    expect(leerCuotas("Concepto")).toBeNull();
  });
});
