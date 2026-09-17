# Cartera · pasada UI montada aislada

- Estado terminal: **PASS**.
- Componentes reales montados: Clientes, React Query generado y helpers cartera.
- Red: todas las solicitudes `/api` fueron interceptadas antes de navegar; no hubo API, sesión, login, usuario ni escritura reales.
- Cobertura: global TODAS, sitio único, multi-sitio, loading, error, metadatos incompatibles, exportación con scope, transición de identidad con QueryClient compartido y responsive 1280/402.
- Fixture binario: bytes de Excel/PDF generados por `clientes-cartera-export.ts`; se parsearon encabezados XLSX y cabecera PDF.
- Límite honesto: la autenticación, middleware, permisos, servidor/API/DB reales y descarga real no fueron verificados; el backend workflow no se reinició.

## Observaciones terminales
{
  "status": "PASS",
  "constraints": {
    "apiTraffic": "all /api requests intercepted before navigation",
    "liveApi": false,
    "authenticationVerified": false,
    "sessionOrUserCreation": false,
    "databaseWrites": 0,
    "workflowRestart": false,
    "productionComponents": [
      "Clientes",
      "useGetCurrentUser",
      "useListLocations",
      "useGetClientesCartera"
    ]
  },
  "scopeTransitions": [
    {
      "scope": "GLOBAL",
      "query": "/api/clientes/cartera",
      "label": "Alcance: Global · Generado 1/2/2026, 12:00:00 p.m."
    },
    {
      "scope": "SITIOS:7",
      "query": "/api/clientes/cartera?ubicacionId=7",
      "label": "Alcance: Sitio: Matriz Textil · Generado 1/2/2026, 12:00:00 p.m."
    },
    {
      "scope": "SITIOS:7,8",
      "query": "/api/clientes/cartera?ubicacionIds=7%2C8",
      "label": "Alcance: Sitios: Matriz Textil, Sucursal Norte · Generado 1/2/2026, 12:00:00 p.m."
    }
  ],
  "authTransitions": [
    {
      "id": 101,
      "oldFinancialTextPresent": false,
      "exportEnabledDuringPending": false
    },
    {
      "id": 202,
      "oldFinancialTextPresent": false,
      "exportEnabledDuringPending": false
    }
  ],
  "roleCases": [
    {
      "role": "CAJA",
      "alcanceConsulta": "TODAS",
      "forcedSite": 7,
      "selectorVisible": false
    },
    {
      "role": "ADMIN",
      "alcanceConsulta": "PROPIA",
      "unrestricted": true,
      "selectorVisible": true
    }
  ],
  "sourceVersions": {
    "artifacts/mariana-textil/src/pages/clientes.tsx": {
      "sha256": "1811d1a75e5057a2c62b124113a21530b14db65c26fac0e4ea0b214dde33efe3",
      "bytes": 42895
    },
    "artifacts/mariana-textil/src/lib/clientes-api.ts": {
      "sha256": "e6c3fd6d62e7ecf3cc113fbf00bcba71151d77cb9aa860da470cf74bb2becceb",
      "bytes": 10407
    },
    ".local/entradas-ajustes-check/src/main.tsx": {
      "sha256": "f7cdf57ee0a4aac6608f86d391050a5d7ec7f1ad12a85b65ebcb32b74cffea54",
      "bytes": 1173
    }
  },
  "binaryFixture": {
    "xlsx": {
      "bytes": 7575,
      "sha256": "e3513d6dfef69ff395aeb88881ca9eb025811196f55c97aa1a9b2faaaf123d1c",
      "headers": [
        "Cliente",
        "Saldo",
        "Saldo a favor",
        "Vencido",
        "Primer vencimiento",
        "Sin plazo definido"
      ]
    },
    "pdf": {
      "bytes": 990,
      "sha256": "5a6a74572ace7ad7fc1c2c1f4cd7f037ac7ff3edaf0b99fab00815836c09a382",
      "startsWithPdfHeader": true
    }
  },
  "metadataMismatchRejected": true,
  "errorStateRendered": true,
  "export": {
    "url": "http://127.0.0.1:4192/api/clientes/cartera.xlsx?ubicacionIds=7%2C8",
    "bytes": 7575
  },
  "authTransitionRows": 1,
  "authTransitionFinalText": 1,
  "desktop": {
    "viewport": "1280x1100",
    "screenshot": "reports/portfolio-scope/screenshots/cartera-desktop.jpg"
  },
  "mobile": {
    "viewport": "402x874",
    "screenshot": "reports/portfolio-scope/screenshots/cartera-mobile.jpg"
  }
}
