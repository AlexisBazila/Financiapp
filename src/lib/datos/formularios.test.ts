import { describe, expect, it } from "vitest";
import { pesosACentavos } from "./formularios";

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
