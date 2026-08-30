import assert from "node:assert/strict";
import test from "node:test";
import type { CurrentUser } from "@workspace/api-client-react";
import { getHomeRoute } from "./home-route";

function user(
  rol: CurrentUser["rol"],
  permisos: CurrentUser["permisos"] = [],
): CurrentUser {
  return {
    id: 1,
    nombre: "Prueba",
    usuario: "prueba",
    rol,
    ubicacion: null,
    alcanceConsulta: "ASIGNADA",
    permisos,
  };
}

test("elige el inicio fijo de los roles operativos principales", () => {
  assert.equal(getHomeRoute(user("TERMINAL")), "/pos");
  assert.equal(getHomeRoute(user("CAJA")), "/cobros");
  assert.equal(getHomeRoute(user("ADMIN")), "/caja/tiempo-real");
});

test("elige para otros roles la primera ruta raíz que ya permiten sus permisos", () => {
  assert.equal(
    getHomeRoute(
      user("BODEGA", [
        {
          modulo: "dashboard",
          puedeVer: true,
          puedeCrear: false,
          puedeEditar: false,
          puedeAutorizar: false,
        },
      ]),
    ),
    "/inventario/vista-global",
  );
  assert.equal(
    getHomeRoute(
      user("BODEGA", [
        {
          modulo: "pos",
          puedeVer: true,
          puedeCrear: false,
          puedeEditar: false,
          puedeAutorizar: false,
        },
      ]),
    ),
    "/pos",
  );
});