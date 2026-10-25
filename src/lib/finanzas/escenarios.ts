import type { Cambio, Datos, Escenario } from "./tipos";

/** Escenarios desde la raíz hasta `id`, en el orden en que se aplican. */
export function cadena(escenarios: Escenario[], id: string): Escenario[] {
  const resultado: Escenario[] = [];
  const vistos = new Set<string>();
  let actual = escenarios.find((e) => e.id === id);
  if (!actual) throw new Error(`No existe el escenario ${id}`);
  while (actual) {
    if (vistos.has(actual.id)) throw new Error(`El escenario ${actual.id} forma un ciclo`);
    vistos.add(actual.id);
    resultado.unshift(actual);
    actual = actual.padreId ? escenarios.find((e) => e.id === actual!.padreId) : undefined;
  }
  return resultado;
}

function aplicarCambio(datos: Datos, cambio: Cambio): Datos {
  // El tipo de Cambio garantiza que el elemento corresponde a la colección.
  const lista = datos[cambio.coleccion] as { id: string }[];
  let nueva: { id: string }[];
  switch (cambio.accion) {
    case "agregar":
      nueva = [...lista, cambio.elemento];
      break;
    case "quitar":
      nueva = lista.filter((e) => e.id !== cambio.id);
      break;
    case "modificar":
      nueva = lista.map((e) => (e.id === cambio.id ? { ...e, ...cambio.campos } : e));
      break;
  }
  return { ...datos, [cambio.coleccion]: nueva };
}

/** Los datos como quedarían en el escenario: el plan base más las diferencias de toda su cadena. */
export function aplicarEscenario(base: Datos, escenarios: Escenario[], id: string): Datos {
  return cadena(escenarios, id)
    .flatMap((e) => e.cambios)
    .reduce(aplicarCambio, base);
}

/**
 * "Me quedo con este escenario": sus cambios pasan al plan base.
 * Los escenarios que partían de él ahora parten del nuevo plan base; el resto queda archivado
 * como histórico, porque se comparaban contra un plan que ya no existe.
 */
export function consolidarEscenario(
  base: Datos,
  escenarios: Escenario[],
  id: string,
): { datos: Datos; escenarios: Escenario[] } {
  const aplicados = new Set(cadena(escenarios, id).map((e) => e.id));
  const datos = aplicarEscenario(base, escenarios, id);

  const actualizados = escenarios.map((e): Escenario => {
    if (aplicados.has(e.id)) return { ...e, estado: "aplicado" };
    if (e.estado !== "activo") return e;
    if (e.padreId === id) return { ...e, padreId: undefined };
    return { ...e, estado: "archivado" };
  });
  return { datos, escenarios: actualizados };
}
