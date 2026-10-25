import { describe, expect, it } from "vitest";
import { cuotasAlemanas, cuotasFrancesas, generarCuotasPlan, repartir } from "./cuotas";
import { consolidarEscenario, aplicarEscenario } from "./escenarios";
import { sumarMeses } from "./fechas";
import { calcularPrevision, CATEGORIA_SALDO_TARJETA } from "./prevision";
import { confirmar, instanciarRecurrente } from "./recurrentes";
import { resumenDeFecha } from "./tarjeta";
import type { Cuenta, Datos, Escenario, PlanCuotas, Recurrente } from "./tipos";

const banco: Cuenta = { id: "banco", nombre: "Banco", tipo: "banco", disponibilidad: "inmediata", saldoInicial: 0 };
const ahorro: Cuenta = { id: "ahorro", nombre: "Ahorro", tipo: "banco", disponibilidad: "reserva", saldoInicial: 0 };
const visa: Cuenta = {
  id: "visa",
  nombre: "Visa",
  tipo: "tarjeta",
  disponibilidad: "inmediata",
  saldoInicial: 0,
  tarjeta: {
    diaCierre: 25,
    diaVencimiento: 5,
    cuentaPagoId: "banco",
    // En noviembre cierra antes de lo habitual.
    ciclos: [{ mes: "2026-11", cierre: "2026-11-20", vencimiento: "2026-12-02" }],
  },
};

const vacio = (): Datos => ({ cuentas: [banco, ahorro, visa], movimientos: [], planesCuotas: [], prestamos: [], recurrentes: [] });

describe("fechas", () => {
  it("suma meses cruzando el año", () => {
    expect(sumarMeses("2026-11", 3)).toBe("2027-02");
    expect(sumarMeses("2026-01", -1)).toBe("2025-12");
  });
});

describe("cuotas", () => {
  it("reparte sin perder centavos", () => {
    expect(repartir(10000, 3)).toEqual([3333, 3333, 3334]);
  });

  it("sistema francés: cuota fija y suma mayor al capital", () => {
    const cuotas = cuotasFrancesas(1_000_000_00, 60, 12);
    expect(new Set(cuotas.slice(0, -1)).size).toBe(1);
    expect(Math.abs(cuotas[11] - cuotas[0])).toBeLessThan(5);
    expect(cuotas.reduce((a, b) => a + b, 0)).toBeGreaterThan(1_000_000_00);
  });

  it("sistema alemán: la cuota baja todos los meses", () => {
    const cuotas = cuotasAlemanas(1_200_000_00, 48, 12);
    for (let k = 1; k < cuotas.length; k++) expect(cuotas[k]).toBeLessThan(cuotas[k - 1]);
  });

  it("en tarjeta, cada cuota cae en un resumen distinto", () => {
    const plan: PlanCuotas = {
      id: "heladera",
      descripcion: "Heladera",
      categoria: "Electrodomésticos",
      cuentaId: "visa",
      fechaCompra: "2026-11-22", // después del cierre de noviembre (20)
      montoTotal: 1_200_000_00,
      cantidad: 3,
    };
    const cuotas = generarCuotasPlan(plan, visa);
    expect(cuotas.map((c) => c.mesResumen)).toEqual(["2026-12", "2027-01", "2027-02"]);
    expect(cuotas[0].descripcion).toBe("Heladera (1/3)");
    expect(cuotas[2].origen).toEqual({ tipo: "cuotas", planId: "heladera", numero: 3, total: 3 });
  });
});

describe("tarjeta", () => {
  it("una compra antes del cierre entra en ese resumen, después en el siguiente", () => {
    expect(resumenDeFecha(visa, "2026-10-25")).toBe("2026-10");
    expect(resumenDeFecha(visa, "2026-10-26")).toBe("2026-11");
    expect(resumenDeFecha(visa, "2026-11-21")).toBe("2026-12");
  });
});

describe("recurrentes", () => {
  const sueldo: Recurrente = {
    id: "sueldo",
    descripcion: "Sueldo",
    tipo: "ingreso",
    categoria: "Sueldo",
    cuentaId: "banco",
    montoEstimado: 2_000_000_00,
    diaDelMes: 1,
    desde: "2026-01",
    requiereConfirmacion: true,
  };

  it("queda pendiente hasta confirmarlo, y el confirmado reemplaza al estimado", () => {
    const [nov] = instanciarRecurrente(sueldo, [], "2026-11", "2026-11");
    expect(nov.estado).toBe("pendiente");
    const real = confirmar(nov, 1_950_000_00);
    const restantes = instanciarRecurrente(sueldo, [real], "2026-11", "2026-12");
    expect(restantes.map((m) => m.origen.tipo === "recurrente" && m.origen.mes)).toEqual(["2026-12"]);
  });
});

describe("previsión", () => {
  it("las compras con tarjeta se pagan el mes del vencimiento", () => {
    const datos = vacio();
    datos.movimientos.push({
      id: "super",
      fecha: "2026-11-10",
      descripcion: "Supermercado",
      tipo: "egreso",
      monto: 100_000_00,
      cuentaId: "visa",
      categoria: "Víveres",
      estado: "real",
      origen: { tipo: "manual" },
    });
    const [nov, dic] = calcularPrevision(datos, { desde: "2026-11", meses: 2 });
    expect(nov.egresos).toBe(0);
    expect(nov.deudaTarjetas).toBe(100_000_00);
    expect(dic.egresosPorCategoria["Víveres"]).toBe(100_000_00);
    expect(dic.deudaTarjetas).toBe(0);
    expect(dic.disponible).toBe(-100_000_00);
  });

  it("el saldo inicial de la tarjeta se paga el primer mes", () => {
    const datos = vacio();
    datos.cuentas = [{ ...banco, saldoInicial: 500_000_00 }, ahorro, { ...visa, saldoInicial: 300_000_00 }];
    const [nov] = calcularPrevision(datos, { desde: "2026-11", meses: 1 });
    expect(nov.egresosPorCategoria[CATEGORIA_SALDO_TARJETA]).toBe(300_000_00);
    expect(nov.disponible).toBe(200_000_00);
    expect(nov.deudaTarjetas).toBe(0);
  });

  it("separa el ahorro reservado de lo disponible", () => {
    const datos = vacio();
    datos.cuentas = [{ ...banco, saldoInicial: 1_000_000_00 }, ahorro, visa];
    datos.movimientos.push({
      id: "apartar",
      fecha: "2026-11-02",
      descripcion: "Ahorro del mes",
      tipo: "transferencia",
      monto: 300_000_00,
      cuentaId: "banco",
      cuentaDestinoId: "ahorro",
      estado: "planificado",
      origen: { tipo: "manual" },
    });
    const [nov] = calcularPrevision(datos, { desde: "2026-11", meses: 1 });
    expect(nov.disponible).toBe(700_000_00);
    expect(nov.reserva).toBe(300_000_00);
    expect(nov.egresos).toBe(0);
  });

  it("se puede ver solo lo real", () => {
    const datos = vacio();
    datos.recurrentes.push({
      id: "sueldo",
      descripcion: "Sueldo",
      tipo: "ingreso",
      categoria: "Sueldo",
      cuentaId: "banco",
      montoEstimado: 2_000_000_00,
      diaDelMes: 1,
      desde: "2026-01",
      requiereConfirmacion: true,
    });
    const [conTodo] = calcularPrevision(datos, { desde: "2026-11", meses: 1 });
    const [soloReal] = calcularPrevision(datos, { desde: "2026-11", meses: 1, estados: ["real"] });
    expect(conTodo.ingresos).toBe(2_000_000_00);
    expect(conTodo.pendientes).toBe(1);
    expect(soloReal.ingresos).toBe(0);
  });
});

describe("escenarios", () => {
  const heladera: PlanCuotas = {
    id: "heladera",
    descripcion: "Heladera",
    categoria: "Electrodomésticos",
    cuentaId: "banco",
    fechaCompra: "2026-11-10",
    montoTotal: 1_200_000_00,
    cantidad: 12,
  };
  const escenarios: Escenario[] = [
    { id: "e-heladera", nombre: "Heladera", estado: "activo", cambios: [{ accion: "agregar", coleccion: "planesCuotas", elemento: heladera }] },
    {
      id: "e-heladera-cara",
      nombre: "Heladera más cara",
      padreId: "e-heladera",
      estado: "activo",
      cambios: [{ accion: "modificar", coleccion: "planesCuotas", id: "heladera", campos: { montoTotal: 1_800_000_00 } }],
    },
    { id: "e-auto", nombre: "Auto", estado: "activo", cambios: [] },
  ];

  it("un escenario no toca el plan base", () => {
    const base = vacio();
    const conHeladera = aplicarEscenario(base, escenarios, "e-heladera");
    expect(base.planesCuotas).toHaveLength(0);
    const [nov] = calcularPrevision(conHeladera, { desde: "2026-11", meses: 1 });
    expect(nov.egresos).toBe(100_000_00);
  });

  it("un escenario hijo parte de su padre", () => {
    const datos = aplicarEscenario(vacio(), escenarios, "e-heladera-cara");
    expect(datos.planesCuotas[0].montoTotal).toBe(1_800_000_00);
  });

  it("aplicar un escenario lo pasa al plan base y archiva las alternativas", () => {
    const r = consolidarEscenario(vacio(), escenarios, "e-heladera");
    expect(r.datos.planesCuotas).toHaveLength(1);
    const estado = Object.fromEntries(r.escenarios.map((e) => [e.id, e]));
    expect(estado["e-heladera"].estado).toBe("aplicado");
    expect(estado["e-auto"].estado).toBe("archivado");
    // El hijo sigue vivo y ahora parte del nuevo plan base.
    expect(estado["e-heladera-cara"].estado).toBe("activo");
    expect(estado["e-heladera-cara"].padreId).toBeUndefined();
  });
});
