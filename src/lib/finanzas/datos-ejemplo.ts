// Datos de ejemplo para ver la previsión funcionando sin base de datos.
// Los montos están inspirados en la planilla "Prevision 2026" (octubre 2026 en adelante).

import { fechaEnMes, rangoMeses } from "./fechas";
import type { Datos, Escenario, Movimiento } from "./tipos";

/** Pesos a centavos. */
const $ = (pesos: number) => Math.round(pesos * 100);

export const MES_INICIAL = "2026-11";
export const MESES = 10;

const apartarAhorro: Movimiento[] = rangoMeses(MES_INICIAL, MESES).map((mes) => ({
  id: `ahorro@${mes}`,
  fecha: fechaEnMes(mes, 2),
  descripcion: "Ahorro del mes (15%)",
  tipo: "transferencia",
  monto: $(340_000),
  cuentaId: "banco",
  cuentaDestinoId: "ahorro",
  estado: "planificado",
  origen: { tipo: "manual" },
}));

export const datosEjemplo: Datos = {
  cuentas: [
    { id: "banco", nombre: "Caja de ahorro", tipo: "banco", disponibilidad: "inmediata", saldoInicial: $(564_860) },
    { id: "ahorro", nombre: "Ahorro", tipo: "banco", disponibilidad: "reserva", saldoInicial: $(822_000) },
    { id: "fci", nombre: "Fondo de inversión", tipo: "inversion", disponibilidad: "48h", saldoInicial: $(400_000) },
    {
      id: "visa",
      nombre: "Visa",
      tipo: "tarjeta",
      disponibilidad: "inmediata",
      saldoInicial: $(1_150_000),
      tarjeta: {
        diaCierre: 26,
        diaVencimiento: 6,
        cuentaPagoId: "banco",
        ciclos: [
          { mes: "2026-11", cierre: "2026-11-27", vencimiento: "2026-12-09" },
          { mes: "2026-12", cierre: "2026-12-23", vencimiento: "2027-01-05" },
        ],
      },
    },
  ],
  movimientos: [
    ...apartarAhorro,
    {
      id: "aguinaldo-dic",
      fecha: "2026-12-18",
      descripcion: "Aguinaldo",
      tipo: "ingreso",
      monto: $(1_000_000),
      cuentaId: "banco",
      categoria: "Aguinaldo",
      estado: "planificado",
      origen: { tipo: "manual" },
    },
    {
      id: "patente-nov",
      fecha: "2026-11-15",
      descripcion: "Patente",
      tipo: "egreso",
      monto: $(63_759),
      cuentaId: "visa",
      categoria: "Automóvil",
      estado: "planificado",
      origen: { tipo: "manual" },
    },
  ],
  planesCuotas: [
    {
      id: "cama",
      descripcion: "Cama",
      categoria: "Hogar",
      cuentaId: "visa",
      fechaCompra: "2026-08-20",
      montoTotal: $(64_150.83 * 12),
      cantidad: 12,
    },
    {
      id: "wall-panel",
      descripcion: "Wall panel",
      categoria: "Mejoras del hogar",
      cuentaId: "visa",
      fechaCompra: "2025-10-20",
      montoTotal: $(2_905.39 * 18),
      cantidad: 18,
    },
  ],
  prestamos: [
    {
      id: "freno",
      descripcion: "Crédito reparación freno",
      categoria: "Créditos",
      cuentaId: "banco",
      capital: 0,
      primeraCuota: "2026-04-10",
      cantidad: 12,
      tasaAnual: 0,
      sistema: "manual",
      cuotasManuales: [
        39511.1, 38850.77, 38618.16, 38330.21, 38068.49, 37773.24, 35880.73, 35569.78, 35218.97, 34871.04,
        34495.69, 34094.13,
      ].map($),
    },
  ],
  recurrentes: [
    { id: "sueldo", descripcion: "Sueldo", tipo: "ingreso", categoria: "Sueldo", cuentaId: "banco", montoEstimado: $(1_800_000), diaDelMes: 1, desde: "2026-01", requiereConfirmacion: true },
    { id: "viatico", descripcion: "Viático", tipo: "ingreso", categoria: "Viático", cuentaId: "banco", montoEstimado: $(357_000), diaDelMes: 1, desde: "2026-01", requiereConfirmacion: true },
    { id: "bonos", descripcion: "Bonos", tipo: "ingreso", categoria: "Bonos", cuentaId: "banco", montoEstimado: $(104_076), diaDelMes: 10, desde: "2026-01", requiereConfirmacion: true },
    { id: "luz", descripcion: "Luz", tipo: "egreso", categoria: "Hogar", cuentaId: "visa", montoEstimado: $(170_000), diaDelMes: 12, desde: "2026-01", requiereConfirmacion: false },
    { id: "internet", descripcion: "Internet", tipo: "egreso", categoria: "Hogar", cuentaId: "visa", montoEstimado: $(31_428), diaDelMes: 8, desde: "2026-01", requiereConfirmacion: false },
    { id: "combustible", descripcion: "Combustible", tipo: "egreso", categoria: "Automóvil", cuentaId: "visa", montoEstimado: $(140_000), diaDelMes: 15, desde: "2026-01", requiereConfirmacion: false },
    { id: "seguro-auto", descripcion: "Seguro del automotor", tipo: "egreso", categoria: "Automóvil", cuentaId: "visa", montoEstimado: $(91_367), diaDelMes: 5, desde: "2026-01", requiereConfirmacion: false },
    { id: "super", descripcion: "Supermercado", tipo: "egreso", categoria: "Víveres", cuentaId: "banco", montoEstimado: $(450_000), diaDelMes: 5, desde: "2026-01", requiereConfirmacion: false },
  ],
};

export const escenariosEjemplo: Escenario[] = [
  {
    id: "heladera",
    nombre: "Heladera en 12 cuotas",
    estado: "activo",
    cambios: [
      {
        accion: "agregar",
        coleccion: "planesCuotas",
        elemento: {
          id: "heladera",
          descripcion: "Heladera",
          categoria: "Electrodomésticos",
          cuentaId: "visa",
          fechaCompra: "2026-11-20",
          montoTotal: $(1_200_000),
          cantidad: 12,
        },
      },
    ],
  },
  {
    id: "auto",
    nombre: "Crédito para el auto",
    estado: "activo",
    cambios: [
      {
        accion: "agregar",
        coleccion: "prestamos",
        elemento: {
          id: "auto",
          descripcion: "Crédito auto",
          categoria: "Créditos",
          cuentaId: "banco",
          capital: $(6_000_000),
          primeraCuota: "2027-01-10",
          cantidad: 48,
          tasaAnual: 45,
          sistema: "frances",
        },
      },
    ],
  },
];
