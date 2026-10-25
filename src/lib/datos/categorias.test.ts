import { describe, expect, it } from "vitest";
import { arbol, conCategoria, rutaCategoria, type Categoria } from "./categorias";

const cat = (c: Partial<Categoria> & Pick<Categoria, "id" | "nombre">): Categoria => ({
  tipo: "egreso",
  icono: "",
  color: "#64748b",
  orden: 0,
  archivada: false,
  ...c,
});

const categorias = [
  cat({ id: "hogar", nombre: "Hogar", icono: "🏠", orden: 2 }),
  cat({ id: "alimentos", nombre: "Alimentos", icono: "🛒", orden: 1 }),
  cat({ id: "verduleria", nombre: "Verdulería", padreId: "alimentos", orden: 2 }),
  cat({ id: "super", nombre: "Supermercado", padreId: "alimentos", orden: 1 }),
  cat({ id: "viejo", nombre: "Viejo", padreId: "alimentos", archivada: true }),
  cat({ id: "sueldo", nombre: "Sueldo", tipo: "ingreso", icono: "💼" }),
];
const porId = new Map(categorias.map((c) => [c.id, c]));

describe("categorías", () => {
  it("arma el árbol de un tipo, en orden y sin archivadas", () => {
    const ramas = arbol(categorias, "egreso");
    expect(ramas.map((r) => r.categoria.id)).toEqual(["alimentos", "hogar"]);
    expect(ramas[0].hijas.map((h) => h.id)).toEqual(["super", "verduleria"]);
    expect(arbol(categorias, "egreso", { archivadas: true })[0].hijas).toHaveLength(3);
    expect(arbol(categorias, "ingreso").map((r) => r.categoria.id)).toEqual(["sueldo"]);
  });

  it("la previsión agrupa por la categoría principal", () => {
    expect(conCategoria({ categoria: "Supermercado", categoriaId: "super" }, porId).categoria).toBe("🛒 Alimentos");
    expect(conCategoria({ categoria: "Hogar", categoriaId: "hogar" }, porId).categoria).toBe("🏠 Hogar");
    // Lo cargado antes de las categorías conserva su texto.
    expect(conCategoria({ categoria: "Víveres" }, porId).categoria).toBe("Víveres");
    expect(conCategoria({ categoria: "Borrada", categoriaId: "no-existe" }, porId).categoria).toBe("Borrada");
  });

  it("muestra la ruta de una subcategoría", () => {
    expect(rutaCategoria(porId, "super")).toBe("🛒 Alimentos › Supermercado");
    expect(rutaCategoria(porId, "sueldo")).toBe("💼 Sueldo");
    expect(rutaCategoria(porId, "no-existe")).toBeUndefined();
  });
});
