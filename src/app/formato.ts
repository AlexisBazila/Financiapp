const formato = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const formatoExacto = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Centavos como pesos redondeados, para grillas: "1.234.567". */
export const pesos = (centavos: number) => formato.format(Math.round(centavos / 100));

/** Centavos como pesos con decimales: "1.234.567,89". */
export const pesosExactos = (centavos: number) => formatoExacto.format(centavos / 100);
