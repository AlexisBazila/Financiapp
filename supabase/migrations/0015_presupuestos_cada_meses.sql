-- Cada cuántos meses se repite un presupuesto: 1 es todos los meses, 2 cada dos meses (desde, desde + 2, …).
-- Un presupuesto de un solo mes tiene `hasta` igual a `desde`.

alter table public.presupuestos
  add column cada_meses smallint not null default 1 check (cada_meses between 1 and 12);
