import { describe, expect, it } from "vitest";
import { monedasAActualizar, ultimaActualizacion } from "./bcra";

describe("cotizaciones del BCRA", () => {
  it("la última actualización son las 17 hs de Argentina de hoy o de ayer", () => {
    // 16:59 en Argentina = 19:59 UTC: todavía cuenta la de ayer.
    expect(ultimaActualizacion(new Date("2026-10-30T19:59:00Z")).toISOString()).toBe("2026-10-29T20:00:00.000Z");
    expect(ultimaActualizacion(new Date("2026-10-30T20:00:00Z")).toISOString()).toBe("2026-10-30T20:00:00.000Z");
    // 23:30 en Argentina = 02:30 UTC del día siguiente.
    expect(ultimaActualizacion(new Date("2026-10-31T02:30:00Z")).toISOString()).toBe("2026-10-30T20:00:00.000Z");
  });

  it("trae las que faltan y las automáticas viejas; no toca las cargadas a mano", () => {
    const ahora = new Date("2026-10-30T21:00:00Z");
    const cotizaciones = {
      USD: { fuente: "BCRA", actualizada: "2026-10-30T12:00:00Z" },
      EUR: { fuente: "manual", actualizada: "2026-10-01T12:00:00Z" },
    };
    expect(monedasAActualizar(cotizaciones, ahora)).toEqual(["USD", "BRL"]);
    expect(
      monedasAActualizar({ ...cotizaciones, USD: { fuente: "BCRA", actualizada: "2026-10-30T20:30:00Z" } }, ahora),
    ).toEqual(["BRL"]);
  });
});
