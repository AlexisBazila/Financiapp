import { describe, expect, it } from "vitest";
import { cuotasAlemanas, cuotasFrancesas, generarCuotasPlan, repartir } from "./cuotas";
import { consolidarEscenario, aplicarEscenario } from "./escenarios";
import { sumarMeses } from "./fechas";
import { calcularPrevision, categoriaResto, montoPresupuesto } from "./prevision";
import { confirmar, instanciarRecurrente } from "./recurrentes";
import { estadoTarjeta, periodoDe } from "./estado-tarjeta";
import { resumenDeFecha } from "./tarjeta";
import type {
  Cuenta,
  Datos,
  Escenario,
  Movimiento,
  ObjetivoAhorro,
  PlanCuotas,
  Prestamo,
  Presupuesto,
  Recurrente,
} from "./tipos";

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

  it("cada cuota lleva el comercio de la compra, para conciliar con el resumen", () => {
    const plan: PlanCuotas = {
      id: "ceramicas",
      descripcion: "Cerámicas",
      categoria: "Hogar",
      contraparte: "Bercomat",
      cuentaId: "visa",
      fechaCompra: "2026-11-10",
      montoTotal: 90_000_00,
      cantidad: 18,
    };
    expect(new Set(generarCuotasPlan(plan, visa).map((c) => c.contraparte))).toEqual(new Set(["Bercomat"]));
  });
});

describe("tarjeta", () => {
  it("una compra antes del cierre entra en ese resumen, después en el siguiente", () => {
    expect(resumenDeFecha(visa, "2026-10-25")).toBe("2026-10");
    expect(resumenDeFecha(visa, "2026-10-26")).toBe("2026-11");
    expect(resumenDeFecha(visa, "2026-11-21")).toBe("2026-12");
    // Comprado el día del cierre entra en ese resumen; al día siguiente, en el del mes que viene.
    expect(resumenDeFecha(visa, "2026-11-20")).toBe("2026-11");
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
  it("las compras con tarjeta son gasto del mes del cierre y se pagan el mes del vencimiento", () => {
    const datos = vacio();
    datos.cuentas = [{ ...banco, saldoInicial: 150_000_00 }, ahorro, visa];
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
    expect(nov.egresosPorCategoria["Víveres"]).toBe(100_000_00);
    expect(nov.disponible).toBe(150_000_00);
    expect(nov.deudaTarjetas).toBe(100_000_00);
    expect(dic.egresos).toBe(0);
    expect(dic.venceTarjetas).toBe(100_000_00);
    expect(dic.deudaTarjetas).toBe(0);
    expect(dic.disponible).toBe(50_000_00);
    expect(dic.pagosTarjeta).toEqual([{ tarjetaId: "visa", cuentaId: "banco", monto: 100_000_00, fecha: "2026-12-02" }]);
  });

  const compraVisa = (monto: number): Movimiento => ({
    id: "compra",
    fecha: "2026-11-10",
    descripcion: "Compra",
    tipo: "egreso",
    monto,
    cuentaId: "visa",
    categoria: "Varios",
    estado: "real",
    origen: { tipo: "manual" },
  });

  it("lo consumido con tarjeta en un mes es la deuda del mes siguiente", () => {
    const datos = vacio();
    datos.cuentas = [{ ...banco, saldoInicial: 500_000_00 }, ahorro, { ...visa, saldoInicial: 80_000_00 }];
    datos.movimientos.push(compraVisa(100_000_00)); // cierra el 20/11, vence el 2/12
    const [nov, dic] = calcularPrevision(datos, { desde: "2026-11", meses: 2 });
    expect(nov.consumoTarjetas).toBe(100_000_00);
    expect(nov.venceTarjetas).toBe(80_000_00);
    expect(dic.consumoTarjetas).toBe(0);
    expect(dic.venceTarjetas).toBe(100_000_00);
  });

  it("el pago automático no deja en negativo la cuenta: lo que falta queda como deuda y se paga después", () => {
    const datos = vacio();
    datos.cuentas = [{ ...banco, saldoInicial: 60_000_00 }, ahorro, visa];
    datos.movimientos.push(compraVisa(100_000_00), {
      id: "sueldo",
      fecha: "2027-01-05",
      descripcion: "Sueldo",
      tipo: "ingreso",
      monto: 200_000_00,
      cuentaId: "banco",
      categoria: "Sueldo",
      estado: "planificado",
      origen: { tipo: "manual" },
    });
    const [, dic, ene] = calcularPrevision(datos, { desde: "2026-11", meses: 3 });
    expect(dic.pagosTarjeta[0].monto).toBe(60_000_00);
    expect(dic.saldos.banco).toBe(0);
    expect(dic.impagoTarjetas).toBe(40_000_00);
    expect(dic.deudaTarjetas).toBe(40_000_00);
    expect(ene.vencidoTarjetas.visa).toBe(40_000_00);
    expect(ene.pagosTarjeta[0].monto).toBe(40_000_00);
    expect(ene.impagoTarjetas).toBe(0);
  });

  it("un pago cargado a mano reemplaza al automático; sin pago automático, solo cuenta lo cargado", () => {
    const pago: Movimiento = {
      id: "pago",
      fecha: "2026-12-02",
      descripcion: "Pago de tarjeta",
      tipo: "transferencia",
      monto: 30_000_00,
      cuentaId: "banco",
      cuentaDestinoId: "visa",
      estado: "real",
      origen: { tipo: "manual" },
    };
    const datos = vacio();
    datos.cuentas = [{ ...banco, saldoInicial: 500_000_00 }, ahorro, visa];
    datos.movimientos.push(compraVisa(100_000_00), pago);
    const [, dic] = calcularPrevision(datos, { desde: "2026-11", meses: 2 });
    expect(dic.pagosTarjeta).toEqual([]);
    expect(dic.saldos.banco).toBe(470_000_00);
    expect(dic.impagoTarjetas).toBe(70_000_00);
    // El gasto se contó en noviembre; el pago es un movimiento entre cuentas.
    expect(dic.egresos).toBe(0);

    const manual = vacio();
    manual.cuentas = [{ ...banco, saldoInicial: 500_000_00 }, ahorro, { ...visa, tarjeta: { ...visa.tarjeta!, pagoAutomatico: false } }];
    manual.movimientos.push(compraVisa(100_000_00));
    const [, dicManual] = calcularPrevision(manual, { desde: "2026-11", meses: 2 });
    expect(dicManual.pagosTarjeta).toEqual([]);
    expect(dicManual.impagoTarjetas).toBe(100_000_00);
  });

  it("el saldo inicial de la tarjeta se paga el primer mes, sin contarlo como gasto", () => {
    const datos = vacio();
    datos.cuentas = [{ ...banco, saldoInicial: 500_000_00 }, ahorro, { ...visa, saldoInicial: 300_000_00 }];
    const [nov] = calcularPrevision(datos, { desde: "2026-11", meses: 1 });
    expect(nov.egresos).toBe(0);
    expect(nov.venceTarjetas).toBe(300_000_00);
    expect(nov.disponible).toBe(200_000_00);
    expect(nov.deudaTarjetas).toBe(0);
  });

  it("no cuenta dos veces lo que ya está en el saldo inicial de la tarjeta", () => {
    const datos = vacio();
    datos.cuentas = [{ ...banco, saldoInicial: 400_000_00 }, ahorro, { ...visa, saldoInicial: 300_000_00 }];
    datos.movimientos.push({
      id: "octubre",
      fecha: "2026-10-10", // resumen de octubre: cierra el 25/10 y se paga en noviembre
      descripcion: "Compra de octubre",
      tipo: "egreso",
      monto: 50_000_00,
      cuentaId: "visa",
      categoria: "Varios",
      estado: "real",
      origen: { tipo: "manual" },
    });
    const [nov] = calcularPrevision(datos, { desde: "2026-11", meses: 1 });
    expect(nov.egresos).toBe(0);
    expect(nov.disponible).toBe(100_000_00);
    expect(nov.deudaTarjetas).toBe(0);
  });

  it("una cuenta en otra moneda cuenta como no inmediata aunque esté marcada como reserva", () => {
    const dolares: Cuenta = {
      id: "usd",
      nombre: "Caja USD",
      tipo: "efectivo",
      disponibilidad: "reserva",
      saldoInicial: 100_00,
      moneda: "USD",
      cambio: 1_545,
    };
    const [nov] = calcularPrevision({ ...vacio(), cuentas: [banco, ahorro, visa, dolares] }, { desde: "2026-11", meses: 1 });
    expect(nov.disponible48h).toBe(154_500_00);
    expect(nov.reserva).toBe(0);
  });

  it("una cuenta en dólares suma en pesos con su tipo de cambio", () => {
    const dolares: Cuenta = {
      id: "usd",
      nombre: "Caja USD",
      tipo: "banco",
      disponibilidad: "48h",
      saldoInicial: 100_00,
      moneda: "USD",
      cambio: 1_400,
    };
    const datos = vacio();
    datos.cuentas = [{ ...banco, saldoInicial: 500_000_00 }, ahorro, visa, dolares];
    datos.movimientos.push({
      id: "compra-usd",
      fecha: "2026-11-03",
      descripcion: "Compra de dólares",
      tipo: "transferencia",
      monto: 280_000_00,
      cuentaId: "banco",
      cuentaDestinoId: "usd",
      estado: "real",
      origen: { tipo: "manual" },
    });
    const [nov] = calcularPrevision(datos, { desde: "2026-11", meses: 1 });
    expect(nov.saldos.usd).toBe(300_00);
    expect(nov.disponible48h).toBe(420_000_00);
    expect(nov.disponible).toBe(220_000_00);
  });

  it("el detalle de cada categoría agrupa las cuotas de una misma compra en todos los meses", () => {
    const datos = vacio();
    datos.cuentas = [{ ...banco, saldoInicial: 1_000_000_00 }, ahorro, visa];
    datos.planesCuotas.push({
      id: "tele",
      descripcion: "Tele",
      categoria: "Hogar",
      cuentaId: "banco",
      fechaCompra: "2026-11-10",
      montoTotal: 300_000_00,
      cantidad: 3,
    });
    datos.movimientos.push({
      id: "lampara",
      fecha: "2026-11-12",
      descripcion: "Lámpara",
      tipo: "egreso",
      monto: 20_000_00,
      cuentaId: "banco",
      categoria: "Hogar",
      estado: "real",
      origen: { tipo: "manual" },
    });
    const [nov, dic] = calcularPrevision(datos, { desde: "2026-11", meses: 2 });
    expect(nov.detalle["egreso:Hogar"].map((i) => [i.clave, i.nombre, i.monto, i.cuota])).toEqual([
      ["cuotas:tele", "Tele", 100_000_00, "1/3"],
      ["lampara", "Lámpara", 20_000_00, undefined],
    ]);
    expect(dic.detalle["egreso:Hogar"][0]).toMatchObject({ clave: "cuotas:tele", cuota: "2/3" });
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

  const tele: PlanCuotas = {
    id: "tele",
    descripcion: "Tele",
    categoria: "Hogar",
    cuentaId: "visa",
    fechaCompra: "2026-11-22", // resumen de diciembre: se paga en enero
    montoTotal: 300_000_00,
    cantidad: 3,
  };

  it("suma lo que queda por pagar en cuotas", () => {
    const datos = { ...vacio(), planesCuotas: [tele] };
    const p = calcularPrevision(datos, { desde: "2026-11", meses: 5 });
    expect(p.map((m) => m.cuotasDelMes)).toEqual([0, 0, 100_000_00, 100_000_00, 100_000_00]);
    expect(p.map((m) => m.deudaCuotas)).toEqual([300_000_00, 300_000_00, 200_000_00, 100_000_00, 0]);
  });

  it("una cuota confirmada reemplaza a la generada", () => {
    const [primera] = generarCuotasPlan(tele, visa);
    const confirmada = { ...primera, id: "uuid-1", estado: "real" as const, monto: 99_000_00, conciliado: true };
    const datos = { ...vacio(), planesCuotas: [tele], movimientos: [confirmada] };
    const p = calcularPrevision(datos, { desde: "2026-11", meses: 5 });
    // Resumen de diciembre: gasto de diciembre, se paga en enero.
    expect(p[1].egresos).toBe(99_000_00);
    expect(p[0].deudaCuotas).toBe(299_000_00);
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

describe("presupuestos", () => {
  const viveres: Presupuesto = {
    id: "viveres",
    nombre: "Víveres",
    icono: "🛒",
    monto: 1_200_000_00,
    cuentaId: "banco",
    desde: "2026-11",
    categoriaIds: ["super", "verdu"],
  };
  const gasto = (id: string, fecha: string, monto: number, categoriaId: string, estado: Movimiento["estado"] = "real"): Movimiento => ({
    id,
    fecha,
    descripcion: id,
    tipo: "egreso",
    monto,
    cuentaId: "banco",
    categoria: "Alimentos",
    categoriaId,
    estado,
    origen: { tipo: "manual" },
  });

  it("descuenta lo gastado y prevé lo que resta", () => {
    const datos: Datos = {
      ...vacio(),
      presupuestos: [viveres],
      movimientos: [
        gasto("super", "2026-11-05", 100_000_00, "super"),
        gasto("verdu", "2026-11-06", 50_000_00, "verdu"),
        gasto("ropa", "2026-11-07", 70_000_00, "ropa"),
      ],
    };
    const [nov, dic] = calcularPrevision(datos, { desde: "2026-11", meses: 2 });
    expect(nov.presupuestos).toEqual([
      { id: "viveres", nombre: "Víveres", monto: 1_200_000_00, gastado: 150_000_00, resto: 1_050_000_00 },
    ]);
    // Lo gastado más lo que resta es el presupuesto completo, más lo que no está en el presupuesto.
    expect(nov.egresos).toBe(1_200_000_00 + 70_000_00);
    expect(nov.egresosPorCategoria[categoriaResto(viveres)]).toBe(1_050_000_00);
    expect(dic.presupuestos[0].resto).toBe(1_200_000_00);
  });

  it("con cuentas elegidas, solo cuenta lo gastado desde esas cuentas", () => {
    const enVisa = { ...gasto("super-visa", "2026-11-08", 40_000_00, "super"), cuentaId: "visa" };
    const movimientos = [gasto("super", "2026-11-05", 100_000_00, "super"), enVisa];
    const todas = calcularPrevision({ ...vacio(), presupuestos: [viveres], movimientos }, { desde: "2026-11", meses: 1 });
    expect(todas[0].presupuestos[0].gastado).toBe(140_000_00);
    const soloBanco = calcularPrevision(
      { ...vacio(), presupuestos: [{ ...viveres, cuentaIds: ["banco"] }], movimientos },
      { desde: "2026-11", meses: 1 },
    );
    expect(soloBanco[0].presupuestos[0].gastado).toBe(100_000_00);
  });

  it("si se pasa, el resto es negativo y no suma gasto", () => {
    const datos: Datos = {
      ...vacio(),
      presupuestos: [{ ...viveres, monto: 100_000_00 }],
      movimientos: [gasto("super", "2026-11-05", 130_000_00, "super")],
    };
    const [nov] = calcularPrevision(datos, { desde: "2026-11", meses: 1 });
    expect(nov.presupuestos[0].resto).toBe(-30_000_00);
    expect(nov.egresos).toBe(130_000_00);
  });

  it("con tarjeta, cuenta en el mes del resumen y lo que resta va al resumen de ese mes", () => {
    // Octubre cierra el 25: lo comprado el 27/10 es del resumen de noviembre.
    const enVisa = { ...gasto("super-visa", "2026-10-27", 40_000_00, "super"), cuentaId: "visa" };
    const datos: Datos = { ...vacio(), presupuestos: [{ ...viveres, cuentaId: "visa" }], movimientos: [enVisa] };
    const [oct, nov, dic] = calcularPrevision(datos, { desde: "2026-10", meses: 3 });
    expect(oct.egresos).toBe(0);
    expect(nov.presupuestos[0].gastado).toBe(40_000_00);
    expect(nov.egresosPorCategoria["Alimentos"]).toBe(40_000_00);
    expect(nov.egresosPorCategoria[categoriaResto(viveres)]).toBe(1_160_000_00);
    // Todo el presupuesto de noviembre es deuda del resumen de noviembre, que vence en diciembre.
    expect(nov.consumoTarjetas).toBe(1_200_000_00);
    expect(dic.venceTarjetas).toBe(1_200_000_00);
  });

  it("con tarjeta, si el resumen del mes ya cerró, no prevé lo que resta", () => {
    const datos: Datos = { ...vacio(), presupuestos: [{ ...viveres, cuentaId: "visa" }] };
    // Noviembre cierra el 20: el 22/11 su período ya pasó.
    const [nov, dic] = calcularPrevision(datos, { desde: "2026-11", meses: 2, mesActual: "2026-11", hoy: "2026-11-22" });
    expect(nov.egresos).toBe(0);
    expect(dic.egresos).toBe(1_200_000_00);
  });

  it("en los meses pasados no prevé lo que no se gastó", () => {
    const datos: Datos = { ...vacio(), presupuestos: [viveres] };
    const [nov, dic] = calcularPrevision(datos, { desde: "2026-11", meses: 2, mesActual: "2026-12" });
    expect(nov.egresos).toBe(0);
    expect(dic.egresos).toBe(1_200_000_00);
  });

  it("marca la certeza de cada celda y si tiene cuotas", () => {
    const datos: Datos = {
      ...vacio(),
      movimientos: [
        { ...gasto("a", "2026-11-05", 10_00, "super"), conciliado: true },
        gasto("b", "2026-11-06", 10_00, "super", "planificado"),
      ],
    };
    const [nov] = calcularPrevision(datos, { desde: "2026-11", meses: 1 });
    expect(nov.celdas["egreso:Alimentos"]).toEqual({ certeza: "planificado", cuotas: false });
  });
});

describe("estado de la tarjeta", () => {
  // Como la Visa de Alexis: octubre cerró el 22/10, noviembre cierra el 19/11 y vence el 1/12.
  const macro: Cuenta = {
    ...visa,
    tarjeta: {
      diaCierre: 20,
      diaVencimiento: 1,
      cuentaPagoId: "banco",
      limite: 4_000_000_00,
      ciclos: [
        { mes: "2026-10", cierre: "2026-10-22", vencimiento: "2026-11-02" },
        { mes: "2026-11", cierre: "2026-11-19", vencimiento: "2026-12-01" },
      ],
    },
  };
  const compra = (id: string, fecha: string, monto: number): Movimiento => ({
    id,
    fecha,
    descripcion: id,
    tipo: "egreso",
    monto,
    cuentaId: "visa",
    categoria: "Alimentos",
    estado: "real",
    origen: { tipo: "manual" },
  });
  const datos = (): Datos => ({
    ...vacio(),
    cuentas: [{ ...banco, saldoInicial: 3_000_000_00 }, ahorro, macro],
    movimientos: [compra("octubre", "2026-10-21", 2_000_000_00), compra("super", "2026-10-23", 150_000_00)],
    planesCuotas: [
      { id: "tele", descripcion: "Tele", categoria: "Hogar", cuentaId: "visa", fechaCompra: "2026-10-24", montoTotal: 300_000_00, cantidad: 3 },
    ],
  });

  it("el período va del día siguiente al cierre anterior hasta el cierre", () => {
    expect(periodoDe(macro, "2026-11")).toEqual({
      mes: "2026-11",
      desde: "2026-10-23",
      cierre: "2026-11-19",
      vencimiento: "2026-12-01",
      cargado: true,
    });
    expect(periodoDe(macro, "2026-12")).toMatchObject({ desde: "2026-11-20", cierre: "2026-12-20", cargado: false });
  });

  it("antes del vencimiento debe lo cerrado más el período en curso; las cuotas futuras ocupan el límite", () => {
    const estado = estadoTarjeta(datos(), "visa", "2026-10-26", "2026-10");
    expect(estado.periodo.mes).toBe("2026-11");
    expect(estado.consumoPeriodo).toBe(150_000_00 + 100_000_00);
    expect(estado.deudaTotal).toBe(2_000_000_00 + 250_000_00);
    expect(estado.cuotasFuturas).toBe(200_000_00);
    expect(estado.disponible).toBe(4_000_000_00 - 2_250_000_00 - 200_000_00);
  });

  it("después del vencimiento descuenta el pago automático", () => {
    const estado = estadoTarjeta(datos(), "visa", "2026-11-05", "2026-10");
    expect(estado.deudaTotal).toBe(250_000_00);
  });
});

describe("objetivos de ahorro", () => {
  const sueldo = (mes: string, monto: number): Movimiento => ({
    id: `sueldo-${mes}`,
    fecha: `${mes}-01`,
    descripcion: "Sueldo",
    tipo: "ingreso",
    monto,
    cuentaId: "banco",
    categoria: "Sueldo",
    estado: "real",
    origen: { tipo: "manual" },
  });
  const ahorroMensual: ObjetivoAhorro = {
    id: "ahorro",
    nombre: "Ahorro",
    icono: "🐷",
    cuentaOrigenId: "banco",
    cuentaDestinoId: "ahorro",
    monto: 100_000_00,
    desde: "2026-11",
  };
  const conAhorro = (objetivo: ObjetivoAhorro, movimientos: Movimiento[] = []): Datos => ({
    ...vacio(),
    cuentas: [{ ...banco, saldoInicial: 500_000_00 }, { ...ahorro, saldoInicial: 751_687_00 }, visa],
    movimientos,
    objetivos: [objetivo],
  });

  it("lo planificado pasa de la cuenta de origen a la reserva a fin de mes", () => {
    const [nov, dic] = calcularPrevision(conAhorro(ahorroMensual), { desde: "2026-11", meses: 2 });
    expect(nov.reserva).toBe(851_687_00);
    expect(nov.disponible).toBe(400_000_00);
    expect(nov.objetivos[0]).toMatchObject({ objetivo: 100_000_00, hecho: 0, previsto: 100_000_00, fecha: "2026-11-30" });
    expect(dic.reserva).toBe(951_687_00);
    // No es un gasto: es plata que se mueve entre cuentas.
    expect(nov.egresos).toBe(0);
    expect(nov.ahorroDelMes).toBe(100_000_00);
  });

  it("lo transferido cuenta como hecho y solo se prevé lo que falta; lo real no incluye lo planificado", () => {
    const transferencia: Movimiento = {
      id: "t",
      fecha: "2026-11-10",
      descripcion: "Ahorro",
      tipo: "transferencia",
      monto: 50_000_00,
      cuentaId: "banco",
      cuentaDestinoId: "ahorro",
      estado: "real",
      origen: { tipo: "manual" },
    };
    const datos = conAhorro(ahorroMensual, [transferencia]);
    const [plan] = calcularPrevision(datos, { desde: "2026-11", meses: 1 });
    expect(plan.objetivos[0]).toMatchObject({ hecho: 50_000_00, previsto: 50_000_00 });
    expect(plan.reserva).toBe(851_687_00);
    const [real] = calcularPrevision(datos, { desde: "2026-11", meses: 1, estados: ["real"] });
    expect(real.reserva).toBe(801_687_00);
    expect(real.objetivos[0]).toMatchObject({ objetivo: 100_000_00, hecho: 50_000_00, previsto: 0 });
    expect(plan.ahorroDelMes).toBe(100_000_00);
    expect(real.ahorroDelMes).toBe(50_000_00);
  });

  it("como porcentaje de los ingresos del mes, con montos a mano en meses puntuales", () => {
    const porcentaje = { ...ahorroMensual, monto: undefined, porcentaje: 10, montosPorMes: { "2026-12": 478_956_68 } };
    const datos = conAhorro(porcentaje, [sueldo("2026-11", 2_000_000_00), sueldo("2026-12", 2_000_000_00)]);
    const [nov, dic] = calcularPrevision(datos, { desde: "2026-11", meses: 2 });
    expect(nov.objetivos[0].objetivo).toBe(200_000_00);
    expect(dic.objetivos[0].objetivo).toBe(478_956_68);
  });

  it("el resto de cada mes (lo que sobra o falta después de gastar y ahorrar) pasa al mes siguiente", () => {
    const datos = conAhorro(ahorroMensual, [sueldo("2026-11", 150_000_00), sueldo("2026-12", 50_000_00)]);
    const [nov, dic] = calcularPrevision(datos, { desde: "2026-11", meses: 2 });
    expect(nov).toMatchObject({ sobranteAnterior: 0, resto: 50_000_00 });
    expect(dic).toMatchObject({ sobranteAnterior: 50_000_00, resto: 0 });
  });

  it("en los meses pasados no prevé lo que no se transfirió", () => {
    const [nov, dic] = calcularPrevision(conAhorro(ahorroMensual), { desde: "2026-11", meses: 2, mesActual: "2026-12" });
    expect(nov.objetivos[0].previsto).toBe(0);
    expect(dic.objetivos[0].previsto).toBe(100_000_00);
  });
});

describe("aumento mensual de los presupuestos", () => {
  it("cada mes es el anterior más el %, desde que empieza", () => {
    const p = { monto: 100_000_00, aumentoMensual: 2, desde: "2026-11" };
    expect(montoPresupuesto(p, "2026-10")).toBe(100_000_00);
    expect(montoPresupuesto(p, "2026-11")).toBe(100_000_00);
    expect(montoPresupuesto(p, "2026-12")).toBe(102_000_00);
    expect(montoPresupuesto(p, "2027-01")).toBe(104_040_00);
  });

  it("la previsión usa el monto con aumento", () => {
    const presupuesto: Presupuesto = {
      id: "super",
      nombre: "Súper",
      icono: "🛒",
      monto: 100_000_00,
      aumentoMensual: 3,
      cuentaId: "banco",
      desde: "2026-11",
      categoriaIds: ["alimentos"],
    };
    const [nov, dic] = calcularPrevision({ ...vacio(), presupuestos: [presupuesto] }, { desde: "2026-11", meses: 2 });
    expect(nov.presupuestos[0].monto).toBe(100_000_00);
    expect(dic.presupuestos[0].monto).toBe(103_000_00);
    expect(dic.egresos).toBe(103_000_00);
  });
});

describe("préstamos", () => {
  const prestamo: Prestamo = {
    id: "freno",
    descripcion: "Crédito freno",
    categoria: "Cuotas de préstamos",
    cuentaId: "banco",
    capital: 300_000_00,
    primeraCuota: "2026-04-08",
    cantidad: 12,
    tasaAnual: 59,
    sistema: "manual",
    cuotasManuales: Array(12).fill(35_569_78),
  };
  const conPrestamo = (p: Prestamo): Datos => ({ ...vacio(), prestamos: [p] });

  it("las cuotas se debitan de la cuenta elegida cada mes, desde la primera", () => {
    const [nov, , , , mar, abr] = calcularPrevision(conPrestamo(prestamo), { desde: "2026-11", meses: 6 });
    expect(nov.egresos).toBe(35_569_78);
    expect(nov.saldos.banco).toBe(-35_569_78);
    expect(mar.egresos).toBe(35_569_78);
    expect(abr.egresos).toBe(0);
    expect(nov.ingresos).toBe(0);
  });

  it("si se confirma a mano, la cuota queda pendiente: cuenta en el plan pero no en lo real", () => {
    const datos = conPrestamo({ ...prestamo, requiereConfirmacion: true });
    const [plan] = calcularPrevision(datos, { desde: "2026-11", meses: 1 });
    expect(plan).toMatchObject({ egresos: 35_569_78, pendientes: 1 });
    const [real] = calcularPrevision(datos, { desde: "2026-11", meses: 1, estados: ["real"] });
    expect(real.egresos).toBe(0);
  });

  it("puede registrar la plata que entra en el mes elegido, aunque las cuotas empiecen después", () => {
    const datos = conPrestamo({ ...prestamo, primeraCuota: "2027-04-08", ingreso: { mes: "2027-02", monto: 300_000_00 } });
    const meses = calcularPrevision(datos, { desde: "2027-02", meses: 3 });
    expect(meses.map((m) => [m.ingresos, m.egresos])).toEqual([
      [300_000_00, 0],
      [0, 0],
      [0, 35_569_78],
    ]);
    expect(meses[0].ingresosPorCategoria).toEqual({ "Préstamos recibidos": 300_000_00 });
    expect(meses[0].deudaCuotas).toBe(12 * 35_569_78);
  });
});
