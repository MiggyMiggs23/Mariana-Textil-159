# Prompt G · BEFORE aislado

- Estado: **PASS**.
- No se editaron fuentes de producción durante esta fase.
- Componentes reales montados: `Entradas`, `CampoEscaneo`, `TicketDetail`, `ClienteNotaCredito` y `ClienteNotaEstadoBadge`, conservando la hoja de estilos de producción.
- Red cerrada: todas las solicitudes `/api` fueron interceptadas antes de navegar; rutas desconocidas y métodos distintos de GET fallan cerrados.
- Límite honesto: no hubo autenticación real, aprobación real, login, creación de usuarios/sesiones, DB, API real ni writes.
- Fixture explícito: nota sintética folio **9001**, no folio real 1005; `autorizacionEstado=AUTORIZADA`, `autorizadoPor=901`, `estadoNota=ABONO_PARCIAL`.
- Stress de cantidad sin submit: Chromium aceptó 100 dígitos en cantidad uniforme, 308 dígitos de `9` en cantidad uniforme y el texto decimal de `Number.MAX_VALUE` (309 dígitos) en `CampoEscaneo`; ambos controles no tienen atributo `max` y conservaron sus valores finitos.
- Geometría: en 1280 y 402 los rectángulos de input/unidad de cantidad y `CampoEscaneo` permanecieron separados; no se inventa un bug de solapamiento.
- Fixture autorizado explícito: `autorizacionEstado=AUTORIZADA`, `autorizadoPor=901` y `estadoNota=ABONO_PARCIAL`, sin usar autorización como predicado de negocio.
- BEFORE observado: `Ticket #9001`, `Cancelar Ticket`, badge de encabezado `PENDIENTE`, sección `Estado de Nota` y badge `ABONO PARCIAL`.
- Preview real sin sesión: `actual-preview-login-desktop.jpg` y `actual-preview-login-mobile.jpg` documentan únicamente la pantalla de login.

## Evidencia
```json
{
  "phase": "BEFORE",
  "status": "PASS",
  "generatedAt": "2026-09-17T04:03:45.658Z",
  "honestLimitation": "Authentication unavailable: synthetic fixtures only; no login, session, users, database, live API, or API writes.",
  "fixturePolicy": {
    "syntheticOnly": true,
    "authenticationVerified": false,
    "realApprovalVerified": false,
    "databaseWrites": 0,
    "apiWrites": 0,
    "apiTraffic": "all API requests intercepted before navigation; unknown paths fail closed",
    "note": "folio 9001 is synthetic and explicitly not real folio 1005; autorizacionEstado=AUTORIZADA, autorizadoPor=901, and ABONO_PARCIAL are fixture fields"
  },
  "productionComponents": [
    "artifacts/mariana-textil/src/pages/entradas.tsx",
    "artifacts/mariana-textil/src/components/campo-escaneo.tsx",
    "artifacts/mariana-textil/src/pages/ticket-detail.tsx",
    "artifacts/mariana-textil/src/components/cliente-nota-credito.tsx",
    "artifacts/mariana-textil/src/components/cliente-nota-estado-badge.tsx"
  ],
  "actualPreviewLoginScreenshots": [
    "reports/prompt-g-before/actual-preview-login-desktop.jpg",
    "reports/prompt-g-before/actual-preview-login-mobile.jpg"
  ],
  "quantity": [
    {
      "viewport": "1280x1100",
      "screenshot": "reports/prompt-g-before/screenshots/before-quantity-desktop.jpg",
      "stress100Length": 100,
      "stress100AcceptedLength": 100,
      "stress308Length": 308,
      "stress308AcceptedLength": 308,
      "stress308Finite": true,
      "largestFiniteTextLength": 309,
      "largestFiniteText": "179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "largestFiniteAcceptedLength": 309,
      "largestFiniteAcceptedFinite": true,
      "maxAttrs": {
        "uniform": null,
        "scanned": null
      },
      "fields": [
        {
          "testId": "input-entrada-producto",
          "type": null,
          "max": null,
          "valueLength": 10,
          "badInput": false
        },
        {
          "testId": "input-declared",
          "type": "number",
          "max": null,
          "valueLength": 1,
          "badInput": false
        },
        {
          "testId": "input-costo-unitario",
          "type": "number",
          "max": null,
          "valueLength": 4,
          "badInput": false
        },
        {
          "testId": "input-fecha-servidor",
          "type": null,
          "max": null,
          "valueLength": 43,
          "badInput": false
        },
        {
          "testId": "input-uniform-qty",
          "type": "number",
          "max": null,
          "valueLength": 308,
          "badInput": false
        },
        {
          "testId": "input-capture-qty",
          "type": "number",
          "max": null,
          "valueLength": 309,
          "badInput": false
        }
      ],
      "geometry": {
        "uniform": {
          "input": {
            "x": 343,
            "y": 386,
            "width": 240.640625,
            "height": 40
          },
          "unit": {
            "x": 583.640625,
            "y": 398,
            "width": 49.921875,
            "height": 16
          }
        },
        "campoEscaneo": {
          "input": {
            "x": 325,
            "y": 460,
            "width": 361.90625,
            "height": 80
          },
          "unit": {
            "x": 694.90625,
            "y": 460,
            "width": 59.203125,
            "height": 80
          }
        }
      },
      "overlaps": {
        "uniform": false,
        "campoEscaneo": false
      },
      "noSubmit": true
    },
    {
      "viewport": "402x874",
      "screenshot": "reports/prompt-g-before/screenshots/before-quantity-mobile.jpg",
      "stress100Length": 100,
      "stress100AcceptedLength": 100,
      "stress308Length": 308,
      "stress308AcceptedLength": 308,
      "stress308Finite": true,
      "largestFiniteTextLength": 309,
      "largestFiniteText": "179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "largestFiniteAcceptedLength": 309,
      "largestFiniteAcceptedFinite": true,
      "maxAttrs": {
        "uniform": null,
        "scanned": null
      },
      "fields": [
        {
          "testId": "input-entrada-producto",
          "type": null,
          "max": null,
          "valueLength": 10,
          "badInput": false
        },
        {
          "testId": "input-declared",
          "type": "number",
          "max": null,
          "valueLength": 1,
          "badInput": false
        },
        {
          "testId": "input-costo-unitario",
          "type": "number",
          "max": null,
          "valueLength": 4,
          "badInput": false
        },
        {
          "testId": "input-fecha-servidor",
          "type": null,
          "max": null,
          "valueLength": 43,
          "badInput": false
        },
        {
          "testId": "input-uniform-qty",
          "type": "number",
          "max": null,
          "valueLength": 308,
          "badInput": false
        },
        {
          "testId": "input-capture-qty",
          "type": "number",
          "max": null,
          "valueLength": 309,
          "badInput": false
        }
      ],
      "geometry": {
        "uniform": {
          "input": {
            "x": 37.64869689941406,
            "y": 275.5197448730469,
            "width": 273.9821319580078,
            "height": 39.985992431640625
          },
          "unit": {
            "x": 311.6308288574219,
            "y": 287.5155334472656,
            "width": 49.904388427734375,
            "height": 15.994384765625
          }
        },
        "campoEscaneo": {
          "input": {
            "x": 19.65500259399414,
            "y": 445.460205078125,
            "width": 292.69433212280273,
            "height": 79.97198486328125
          },
          "unit": {
            "x": 321.796875,
            "y": 448.2265625,
            "width": 59.203125,
            "height": 80
          }
        }
      },
      "overlaps": {
        "uniform": false,
        "campoEscaneo": false
      },
      "noSubmit": true
    }
  ],
  "ticket": [
    {
      "viewport": "1280x1100",
      "screenshot": "reports/prompt-g-before/screenshots/before-ticket-detail-desktop.jpg",
      "fixture": "synthetic note folio 9001 (not real 1005), autorizacionEstado=AUTORIZADA, autorizadoPor=901, estadoNota=ABONO_PARCIAL",
      "title": "Ticket #9001",
      "cancel": "Cancelar Ticket",
      "headerStatusObserved": true,
      "notaBadgeTexts": [
        "ABONO PARCIAL"
      ],
      "oldText": {
        "title": "Ticket",
        "cancel": "Cancelar Ticket",
        "headerBadge": "PENDIENTE",
        "noteSection": "Estado de Nota"
      }
    },
    {
      "viewport": "402x874",
      "screenshot": "reports/prompt-g-before/screenshots/before-ticket-detail-mobile.jpg",
      "fixture": "synthetic note folio 9001 (not real 1005), autorizacionEstado=AUTORIZADA, autorizadoPor=901, estadoNota=ABONO_PARCIAL",
      "title": "Ticket #9001",
      "cancel": "Cancelar Ticket",
      "headerStatusObserved": true,
      "notaBadgeTexts": [
        "ABONO PARCIAL"
      ],
      "oldText": {
        "title": "Ticket",
        "cancel": "Cancelar Ticket",
        "headerBadge": "PENDIENTE",
        "noteSection": "Estado de Nota"
      }
    }
  ],
  "network": [
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/entradas"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@vite/client"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/src/main.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@react-refresh"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/node_modules/.pnpm/vite@7.3.6_@types+node@25.9.5_jiti@2.7.0_lightningcss@1.32.0_tsx@4.23.1_yaml@2.9.0/node_modules/vite/dist/client/env.mjs"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/react-dom_client.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@tanstack_react-query.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/wouter.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/pages/entradas.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/pages/ticket-detail.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/src/harness.css"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-O4BUER6X.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-ILHRZGIS.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-JJ3WJUXN.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-AOSWHDFT.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/internal-navigation.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/button.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/card.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/hooks/use-toast.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/lucide-react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/dialog.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/input.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/label.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/textarea.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/permisos.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/api-error.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/password-input.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/number-format/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/ticket-lines.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/monochrome-brand-logo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/printable-document-header.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/print.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/confirmacion-texto-exacto.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/cliente-nota-credito.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/date-only.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/src/app-layout.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/product-combobox.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/select.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/checkbox.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/table.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/badge.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/sonner.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/roll-capture-state.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/entrada-review.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/campo-escaneo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/entrada-history.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/tabs.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-slot.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/class-variance-authority.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/utils.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/generated/api.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/generated/api.schemas.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/custom-fetch.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-dialog.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-label.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo-monochrome.png?import"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/brand-logo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/document-qr-code.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/confirmacion-texto-exacto.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-checkbox.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-select.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/date-fns.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/cliente-nota-estado-badge.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-FNHC6X6J.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-tabs.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/scanned-code/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-EYRZ3RSY.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/clsx.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/tailwind-merge.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-E3W2AJ3Y.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-4FWQ6M3D.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-TJBIQO7N.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-GTSEM464.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo.png?import"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/qrcode__react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-6BDATJCK.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-XOK6I6U4.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/inventario/entradas?page=1&pageSize=10"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/auth/me"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/inventario/entradas/catalogos"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/inventario/fecha-servidor"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/locations"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/locations/7/pisos"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/contenedores/disponibles-entrada?ubicacionId=7"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/entradas"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@vite/client"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/src/main.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@react-refresh"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/react-dom_client.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@tanstack_react-query.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/wouter.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/pages/entradas.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/pages/ticket-detail.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/src/harness.css"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/node_modules/.pnpm/vite@7.3.6_@types+node@25.9.5_jiti@2.7.0_lightningcss@1.32.0_tsx@4.23.1_yaml@2.9.0/node_modules/vite/dist/client/env.mjs"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-O4BUER6X.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-ILHRZGIS.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-AOSWHDFT.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/internal-navigation.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/button.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/card.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/hooks/use-toast.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/lucide-react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/dialog.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/input.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/label.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/textarea.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/permisos.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/api-error.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/password-input.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/number-format/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/ticket-lines.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/monochrome-brand-logo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/printable-document-header.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/print.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/confirmacion-texto-exacto.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/cliente-nota-credito.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/date-only.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-JJ3WJUXN.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/src/app-layout.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/product-combobox.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/select.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/checkbox.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/table.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/badge.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/sonner.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/roll-capture-state.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/entrada-review.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/campo-escaneo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/entrada-history.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/tabs.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-slot.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/class-variance-authority.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/utils.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/generated/api.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/generated/api.schemas.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/custom-fetch.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-label.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-dialog.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo-monochrome.png?import"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/brand-logo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/document-qr-code.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/confirmacion-texto-exacto.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/date-fns.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/cliente-nota-estado-badge.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-checkbox.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-select.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-tabs.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/scanned-code/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-FNHC6X6J.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/clsx.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/tailwind-merge.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-EYRZ3RSY.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-E3W2AJ3Y.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo.png?import"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-4FWQ6M3D.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-TJBIQO7N.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-GTSEM464.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/qrcode__react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-6BDATJCK.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-XOK6I6U4.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/inventario/entradas?page=1&pageSize=10"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/auth/me"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/inventario/entradas/catalogos"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/inventario/fecha-servidor"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/locations"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/locations/7/pisos"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/contenedores/disponibles-entrada?ubicacionId=7"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/tickets/9001"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@vite/client"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/src/main.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@react-refresh"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/node_modules/.pnpm/vite@7.3.6_@types+node@25.9.5_jiti@2.7.0_lightningcss@1.32.0_tsx@4.23.1_yaml@2.9.0/node_modules/vite/dist/client/env.mjs"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/react-dom_client.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@tanstack_react-query.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/wouter.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/pages/entradas.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/pages/ticket-detail.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/src/harness.css"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-O4BUER6X.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-ILHRZGIS.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-AOSWHDFT.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/internal-navigation.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/button.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/card.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/hooks/use-toast.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/lucide-react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/dialog.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/input.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/label.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/textarea.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/permisos.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/api-error.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/password-input.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/number-format/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/ticket-lines.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/monochrome-brand-logo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/printable-document-header.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/print.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/confirmacion-texto-exacto.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/cliente-nota-credito.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/date-only.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/src/app-layout.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/product-combobox.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/select.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/checkbox.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/table.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/badge.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/sonner.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/roll-capture-state.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/entrada-review.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/campo-escaneo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/entrada-history.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/tabs.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-JJ3WJUXN.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/generated/api.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/generated/api.schemas.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/custom-fetch.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-slot.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/class-variance-authority.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/utils.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-dialog.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-label.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo-monochrome.png?import"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/confirmacion-texto-exacto.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/brand-logo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/document-qr-code.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/date-fns.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/cliente-nota-estado-badge.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-select.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-checkbox.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-tabs.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/scanned-code/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-FNHC6X6J.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-EYRZ3RSY.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/clsx.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/tailwind-merge.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-E3W2AJ3Y.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-4FWQ6M3D.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-TJBIQO7N.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-GTSEM464.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo.png?import"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/qrcode__react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-6BDATJCK.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-XOK6I6U4.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/auth/me"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/tickets/9001"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/clientes/1/notas/9001"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/auth/me"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/tickets/9001/documento-impresion?copia=INTERNA"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/tickets/9001/documento-impresion?copia=CLIENTE"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo-monochrome.png"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo.png"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/tickets/9001"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@vite/client"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/src/main.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@react-refresh"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/node_modules/.pnpm/vite@7.3.6_@types+node@25.9.5_jiti@2.7.0_lightningcss@1.32.0_tsx@4.23.1_yaml@2.9.0/node_modules/vite/dist/client/env.mjs"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/react-dom_client.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@tanstack_react-query.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/wouter.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/pages/entradas.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/pages/ticket-detail.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/src/harness.css"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-O4BUER6X.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-ILHRZGIS.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/internal-navigation.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/button.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/card.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/hooks/use-toast.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/lucide-react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/dialog.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/input.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/label.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/textarea.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/permisos.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/api-error.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/password-input.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/number-format/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/ticket-lines.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/monochrome-brand-logo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/printable-document-header.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/print.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/confirmacion-texto-exacto.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/cliente-nota-credito.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/date-only.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/src/app-layout.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/product-combobox.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/select.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/checkbox.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/table.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/badge.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/sonner.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/roll-capture-state.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/entrada-review.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/campo-escaneo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/entrada-history.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/tabs.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-AOSWHDFT.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-JJ3WJUXN.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/generated/api.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/generated/api.schemas.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/custom-fetch.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-slot.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/class-variance-authority.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/utils.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-dialog.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-label.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo-monochrome.png?import"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/brand-logo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/document-qr-code.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/confirmacion-texto-exacto.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/date-fns.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/cliente-nota-estado-badge.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-select.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-checkbox.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/scanned-code/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-tabs.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-FNHC6X6J.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/clsx.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/tailwind-merge.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-EYRZ3RSY.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-E3W2AJ3Y.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo.png?import"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-4FWQ6M3D.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-TJBIQO7N.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-GTSEM464.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/qrcode__react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-XOK6I6U4.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-6BDATJCK.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/auth/me"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/tickets/9001"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/clientes/1/notas/9001"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/auth/me"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/tickets/9001/documento-impresion?copia=INTERNA"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/api/tickets/9001/documento-impresion?copia=CLIENTE"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo-monochrome.png"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo.png"
    }
  ],
  "blocked": [],
  "sourceHashes": {
    "artifacts/mariana-textil/src/pages/entradas.tsx": {
      "sha256": "902ce7dba933a116fb9161019c5b447cedc5dba51313ae3446fde313a68e0534",
      "bytes": 84431
    },
    "artifacts/mariana-textil/src/components/campo-escaneo.tsx": {
      "sha256": "5f434a5c43d37cc5a90f5b5a4a0eaedc564d6c39a078e91af62f46eb6e15ec32",
      "bytes": 12891
    },
    "artifacts/mariana-textil/src/pages/ticket-detail.tsx": {
      "sha256": "bfb0ea5bfb1e3ab40fc63843928d6a2e6470785ae99eec2da0b57b7d3823a5c1",
      "bytes": 51845
    },
    "artifacts/mariana-textil/src/components/cliente-nota-credito.tsx": {
      "sha256": "842add8e2bd40ed878820563c30b1658fbc4d20790551f4232e43be654ad9731",
      "bytes": 18834
    },
    "artifacts/mariana-textil/src/components/cliente-nota-estado-badge.tsx": {
      "sha256": "866b5eb451c4f829ccaaa25d4858414c8230af25d753bdcc2804eaf568055d90",
      "bytes": 2106
    },
    "lib/number-format/src/index.ts": {
      "sha256": "94b2be43d275796cbeb3be209541ceaabb4a9c085dcc1ed4d8f0cfc4551db60a",
      "bytes": 5787
    }
  }
}
```
