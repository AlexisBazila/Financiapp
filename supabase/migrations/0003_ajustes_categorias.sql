-- Ajustes a las categorías iniciales, para los hogares que ya corrieron la versión anterior de 0002.
-- Si 0002 se corrió con la versión actual, no cambia nada.

-- Delicias Luna pasa a AB System; las subcategorías de cada emprendimiento llevan solo su nombre.
update public.categorias set nombre = 'AB System'
where nombre in ('Insumos Delicias Luna', 'Ventas Delicias Luna');
update public.categorias set nombre = 'Bynailtica'
where nombre in ('Insumos Bynailtica', 'Ventas Bynailtica');

update public.categorias c set nombre = 'Limpieza del hogar'
from public.categorias p
where p.id = c.padre_id and p.nombre = 'Hogar' and c.nombre = 'Limpieza';

-- Emoji para las subcategorías iniciales que no tienen.
update public.categorias c set icono = v.icono
from public.categorias p,
  (values
    ('Alimentos', 'Supermercado', '🛒'),
    ('Alimentos', 'Verdulería', '🥬'),
    ('Alimentos', 'Carnicería', '🥩'),
    ('Alimentos', 'Panadería', '🥖'),
    ('Alimentos', 'Lácteos y huevos', '🥛'),
    ('Alimentos', 'Dietética', '🌾'),
    ('Alimentos', 'Bebidas', '🥤'),
    ('Hogar', 'Alquiler y expensas', '🔑'),
    ('Hogar', 'Mantenimiento y arreglos', '🔧'),
    ('Hogar', 'Remodelaciones', '🧱'),
    ('Hogar', 'Decoración', '🖼️'),
    ('Hogar', 'Electrodomésticos', '🔌'),
    ('Hogar', 'Limpieza del hogar', '🧽'),
    ('Servicios', 'Luz', '💡'),
    ('Servicios', 'Gas', '🔥'),
    ('Servicios', 'Agua', '💧'),
    ('Servicios', 'Internet', '🌐'),
    ('Servicios', 'Telefonía', '📱'),
    ('Servicios', 'Suscripciones', '📺'),
    ('Auto y transporte', 'Combustible', '⛽'),
    ('Auto y transporte', 'Seguro del auto', '🛡️'),
    ('Auto y transporte', 'Taller y mantenimiento', '🔧'),
    ('Auto y transporte', 'Patente y peajes', '🧾'),
    ('Auto y transporte', 'Estacionamiento', '🅿️'),
    ('Auto y transporte', 'Transporte público', '🚌'),
    ('Salud', 'Farmacia', '💊'),
    ('Salud', 'Consultas médicas', '🏥'),
    ('Salud', 'Obra social o prepaga', '🪪'),
    ('Ropa y cuidado personal', 'Ropa y calzado', '👟'),
    ('Ropa y cuidado personal', 'Belleza', '💄'),
    ('Ropa y cuidado personal', 'Peluquería', '💈'),
    ('Ropa y cuidado personal', 'Gimnasio', '🏋️'),
    ('Educación', 'Cursos', '📝'),
    ('Educación', 'Inglés', '🇬🇧'),
    ('Educación', 'Libros y materiales', '📚'),
    ('Ocio y salidas', 'Restaurantes y delivery', '🍔'),
    ('Ocio y salidas', 'Cafetería', '☕'),
    ('Ocio y salidas', 'Heladería', '🍦'),
    ('Ocio y salidas', 'Viajes', '✈️'),
    ('Ocio y salidas', 'Salidas', '🎬'),
    ('Regalos y eventos', 'Regalos', '🎁'),
    ('Regalos y eventos', 'Celebraciones', '🎂'),
    ('Seguros', 'Seguro de vida', '❤️'),
    ('Seguros', 'Seguro viajero', '🧳'),
    ('Finanzas', 'Cuotas de préstamos', '🏦'),
    ('Finanzas', 'Intereses', '📉'),
    ('Finanzas', 'Comisiones bancarias', '🧾'),
    ('Finanzas', 'Impuestos', '🏛️'),
    ('Emprendimientos', 'Bynailtica', '💅'),
    ('Emprendimientos', 'AB System', '💻'),
    ('Sueldo', 'Sueldo', '💵'),
    ('Sueldo', 'Aguinaldo', '🎄'),
    ('Sueldo', 'Premios y bonos', '🏆'),
    ('Sueldo', 'Viáticos', '🚗'),
    ('Emprendimientos', 'Bynailtica', '💅'),
    ('Emprendimientos', 'AB System', '💻'),
    ('Rendimientos', 'Intereses y FCI', '📈'),
    ('Rendimientos', 'Dividendos', '💹'),
    ('Reintegros', 'Devoluciones', '↩️'),
    ('Reintegros', 'Descuentos y reintegros', '🏷️')
  ) as v(padre, nombre, icono)
where p.id = c.padre_id and p.nombre = v.padre and c.nombre = v.nombre and c.icono = '';
