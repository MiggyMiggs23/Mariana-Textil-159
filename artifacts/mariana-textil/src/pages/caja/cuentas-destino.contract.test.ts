import { describe, it } from "node:test";
import assert from "node:assert";
import { 
  getGetAdminCuentasDestinoQueryKey, 
  getListAdminCuentaDestinoMovimientosQueryKey 
} from "@workspace/api-client-react";

describe("Cuentas Destino Contract", () => {
  it("generates correct query key for cuentas destino list with location scope", () => {
    const key = getGetAdminCuentasDestinoQueryKey({
      desde: "2024-01-01",
      hasta: "2024-01-31",
      ubicacionId: 5
    });
    
    assert.deepStrictEqual(key, [
      "/api/admin/cuentas-destino",
      { desde: "2024-01-01", hasta: "2024-01-31", ubicacionId: 5 }
    ]);
  });

  it("generates correct query key for cuenta destino detalle including matrix cell filters", () => {
    const key = getListAdminCuentaDestinoMovimientosQueryKey("CAJA_FISICA", {
      desde: "2024-01-01",
      hasta: "2024-01-31",
      ubicacionId: 5,
      facturado: true,
      formaPago: "EFECTIVO",
      incongruente: true,
      page: 1,
      pageSize: 50
    });

    assert.deepStrictEqual(key, [
      "/api/admin/cuentas-destino/CAJA_FISICA/movimientos",
      { 
        desde: "2024-01-01", 
        hasta: "2024-01-31", 
        ubicacionId: 5,
        facturado: true,
        formaPago: "EFECTIVO",
        incongruente: true,
        page: 1,
        pageSize: 50
      }
    ]);
  });
});