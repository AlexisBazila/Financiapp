/** Monedas que puede tener una cuenta, con su símbolo. */
export const MONEDAS = { ARS: "$", USD: "US$", EUR: "€", BRL: "R$" } as const;

export type Moneda = keyof typeof MONEDAS;

export const esMoneda = (codigo: string): codigo is Moneda => Object.hasOwn(MONEDAS, codigo);

export const simbolo = (codigo?: string): string => (codigo && esMoneda(codigo) ? MONEDAS[codigo] : "$");
