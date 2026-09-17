# Prompt G · AFTER aislado

- Estado: **PARCIAL / BLOQUEADO**. La revisión invalidó la comprobación de la insignia: el fixture añade `autorizacionEstado`, pero `ObtenerTicketResponse` elimina ese dato y `TicketDetalle` no lo declara. Las capturas de “Nota autorizada” no representan lo que puede entregar la API real. No se aprueba el Bloque 3 ni la entrega completa. No se cambió el contrato.
- AFTER capturado contra las fuentes de producción editadas por el agente principal; este harness no modifica producción.
- Componentes reales montados: `Entradas`, `CampoEscaneo`, `TicketDetail`, `ClienteNotaCredito` y `ClienteNotaEstadoBadge`, conservando la hoja de estilos de producción.
- Red cerrada: todas las solicitudes `/api` fueron interceptadas antes de navegar; rutas desconocidas y métodos distintos de GET fallan cerrados.
- Límite honesto: no hubo autenticación real, aprobación real, login, creación de usuarios/sesiones, DB, API real ni writes.
- Fixture explícito: nota sintética folio **9001**, no folio real 1005; `autorizacionEstado=AUTORIZADA`, `autorizadoPor=901`, `estadoNota=ABONO_PARCIAL`.
- Stress de cantidad sin submit: Chromium aceptó 100 dígitos, 308 dígitos de `9` y el texto decimal de `Number.MAX_VALUE` (309 dígitos) en cantidad uniforme; el texto de `Number.MAX_VALUE` (309 dígitos) también fue aceptado en `CampoEscaneo`. Ambos controles no tienen atributo `max` y conservaron valores finitos.
- Geometría: en 1280 y 402 los rectángulos de input/unidad de cantidad y `CampoEscaneo` permanecieron separados; no se inventa un bug de solapamiento.
- Fixture autorizado explícito: `autorizacionEstado=AUTORIZADA`, `autorizadoPor=901` y `estadoNota=ABONO_PARCIAL`, sin usar autorización como predicado de negocio.
- AFTER observado: `Nota #9001`, `Cancelar Nota`, badge verde `Nota autorizada`, sección `Estado de Nota` y badge ámbar `ABONO PARCIAL`; la confirmación se abrió sin hacer click en la mutación final.
- Preview real sin sesión: `actual-preview-login-desktop.jpg` y `actual-preview-login-mobile.jpg` documentan únicamente la pantalla de login.

## Evidencia
```json
{
  "phase": "AFTER",
  "status": "PARTIAL_BLOCKED_INVALID_STATUS_FIXTURE",
  "generatedAt": "2026-09-17T04:14:06.645Z",
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
  "documentNameMatrix": [
    {
      "documentoTipo": "NOTA",
      "autorizacionEstado": "AUTORIZADA",
      "cobrado": false,
      "expected": "Nota autorizada"
    },
    {
      "documentoTipo": "NOTA",
      "autorizacionEstado": "PENDIENTE",
      "cobrado": false,
      "expected": "Nota por autorizar"
    },
    {
      "documentoTipo": "TICKET",
      "autorizacionEstado": "AUTORIZADA",
      "cobrado": true,
      "expected": "Ticket cobrado"
    },
    {
      "documentoTipo": "TICKET",
      "autorizacionEstado": "AUTORIZADA",
      "cobrado": false,
      "expected": "Ticket por cobrar"
    },
    {
      "documentoTipo": "TICKET",
      "cobrado": null,
      "expected": "Ticket registrado"
    },
    {
      "cobrado": null,
      "expected": "Documento: estado sin confirmar",
      "noNotaFetch": true
    }
  ],
  "quantity": [
    {
      "viewport": "1280x1100",
      "screenshot": "reports/prompt-g-after/screenshots/after-quantity-desktop.jpg",
      "stress100Length": 100,
      "stress100AcceptedLength": 100,
      "stress308Length": 308,
      "stress308AcceptedLength": 308,
      "stress308Finite": true,
      "largestFiniteTextLength": 309,
      "largestFiniteText": "179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "uniformLargestFiniteAcceptedLength": 309,
      "uniformLargestFiniteAcceptedFinite": true,
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
          "valueLength": 309,
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
      "screenshot": "reports/prompt-g-after/screenshots/after-quantity-mobile.jpg",
      "stress100Length": 100,
      "stress100AcceptedLength": 100,
      "stress308Length": 308,
      "stress308AcceptedLength": 308,
      "stress308Finite": true,
      "largestFiniteTextLength": 309,
      "largestFiniteText": "179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "uniformLargestFiniteAcceptedLength": 309,
      "uniformLargestFiniteAcceptedFinite": true,
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
          "valueLength": 309,
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
            "x": 39,
            "y": 278.2265625,
            "width": 274.078125,
            "height": 40
          },
          "unit": {
            "x": 313.078125,
            "y": 290.2265625,
            "width": 49.921875,
            "height": 16
          }
        },
        "campoEscaneo": {
          "input": {
            "x": 21,
            "y": 448.2265625,
            "width": 292.796875,
            "height": 80
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
      "screenshot": "reports/prompt-g-after/screenshots/after-ticket-detail-desktop.jpg",
      "fixture": "synthetic note folio 9001 (not real 1005), autorizacionEstado=AUTORIZADA, autorizadoPor=901, estadoNota=ABONO_PARCIAL",
      "title": "Nota #9001",
      "cancel": "Cancelar Nota",
      "headerStatusObserved": true,
      "notaBadgeTexts": [
        "ABONO PARCIAL"
      ],
      "confirmation": {
        "title": "Cancelar Nota",
        "description": "Cancelar Nota\n\nSe cancelará Nota #9001 y se revertirán sus movimientos de inventario. Esta acción no se puede deshacer.\n\nConfirmación del folio de Nota\n\nEscribe exactamente 9001.\n\nEl botón de confirmación se habilita únicamente cuando el texto coincide exactamente.\n\nCancelar\nCancelar nota definitivamente\nCerrar",
        "finalActionNotClicked": true,
        "apiMutationsObserved": []
      },
      "oldText": {
        "title": "Nota",
        "cancel": "Cancelar Nota",
        "headerBadge": "Nota autorizada",
        "noteSection": "Estado de Nota"
      }
    },
    {
      "viewport": "402x874",
      "screenshot": "reports/prompt-g-after/screenshots/after-ticket-detail-mobile.jpg",
      "fixture": "synthetic note folio 9001 (not real 1005), autorizacionEstado=AUTORIZADA, autorizadoPor=901, estadoNota=ABONO_PARCIAL",
      "title": "Nota #9001",
      "cancel": "Cancelar Nota",
      "headerStatusObserved": true,
      "notaBadgeTexts": [
        "ABONO PARCIAL"
      ],
      "confirmation": {
        "title": "Cancelar Nota",
        "description": "Cancelar Nota\n\nSe cancelará Nota #9001 y se revertirán sus movimientos de inventario. Esta acción no se puede deshacer.\n\nConfirmación del folio de Nota\n\nEscribe exactamente 9001.\n\nEl botón de confirmación se habilita únicamente cuando el texto coincide exactamente.\n\nCancelar\nCancelar nota definitivamente\nCerrar",
        "finalActionNotClicked": true,
        "apiMutationsObserved": []
      },
      "oldText": {
        "title": "Nota",
        "cancel": "Cancelar Nota",
        "headerBadge": "Nota autorizada",
        "noteSection": "Estado de Nota"
      }
    }
  ],
  "unitSpacing": [
    {
      "viewport": "1280x1100",
      "unidad": "METRO",
      "visible": {
        "uniform": "Mts.",
        "campoEscaneo": "Mts."
      },
      "gapPx": {
        "uniform": 0,
        "campoEscaneo": 7.645355224609375
      },
      "noOverlap": true
    },
    {
      "viewport": "1280x1100",
      "unidad": "KILO",
      "visible": {
        "uniform": "Kg.",
        "campoEscaneo": "Kg."
      },
      "gapPx": {
        "uniform": 0,
        "campoEscaneo": 7.738433837890625
      },
      "noOverlap": true
    },
    {
      "viewport": "1280x1100",
      "unidad": "BOLSA",
      "visible": {
        "uniform": "Bolsas",
        "campoEscaneo": "Bolsas"
      },
      "gapPx": {
        "uniform": 0,
        "campoEscaneo": 7.600006103515625
      },
      "noOverlap": true
    },
    {
      "viewport": "1280x1100",
      "unidad": "PIEZA",
      "visible": {
        "uniform": "Pzas.",
        "campoEscaneo": "Pzas."
      },
      "gapPx": {
        "uniform": 0,
        "campoEscaneo": 7.600006103515625
      },
      "noOverlap": true
    },
    {
      "viewport": "402x874",
      "unidad": "METRO",
      "visible": {
        "uniform": "Mts.",
        "campoEscaneo": "Mts."
      },
      "gapPx": {
        "uniform": 0,
        "campoEscaneo": 7.6452178955078125
      },
      "noOverlap": true
    },
    {
      "viewport": "402x874",
      "unidad": "KILO",
      "visible": {
        "uniform": "Kg.",
        "campoEscaneo": "Kg."
      },
      "gapPx": {
        "uniform": 0,
        "campoEscaneo": 7.645294189453125
      },
      "noOverlap": true
    },
    {
      "viewport": "402x874",
      "unidad": "BOLSA",
      "visible": {
        "uniform": "Bolsas",
        "campoEscaneo": "Bolsas"
      },
      "gapPx": {
        "uniform": 0,
        "campoEscaneo": 7.645477294921875
      },
      "noOverlap": true
    },
    {
      "viewport": "402x874",
      "unidad": "PIEZA",
      "visible": {
        "uniform": "Pzas.",
        "campoEscaneo": "Pzas."
      },
      "gapPx": {
        "uniform": 0,
        "campoEscaneo": 7.645271301269531
      },
      "noOverlap": true
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/document-name.ts"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-dialog.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-label.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/confirmacion-texto-exacto.ts"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/document-name.ts"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/document-name.ts"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/utils.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-dialog.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-label.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo-monochrome.png?import"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-E3W2AJ3Y.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo.png?import"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/document-name.ts"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-FNHC6X6J.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/src/app-layout.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/product-combobox.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/card.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/button.tsx"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/select.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/dialog.tsx"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/lucide-react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/api-error.ts"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/number-format/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/campo-escaneo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/internal-navigation.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/permisos.ts"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/hooks/use-toast.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/textarea.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/password-input.tsx"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/document-name.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-JJ3WJUXN.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-select.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-slot.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/class-variance-authority.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-label.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-checkbox.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-dialog.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/scanned-code/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/date-fns.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-tabs.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/cliente-nota-estado-badge.tsx"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-XOK6I6U4.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-6BDATJCK.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-GTSEM464.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-E3W2AJ3Y.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo.png?import"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/qrcode__react.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/document-name.ts"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/clsx.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/tailwind-merge.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-E3W2AJ3Y.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-XOK6I6U4.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-6BDATJCK.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/document-name.ts"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/date-fns.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/cliente-nota-estado-badge.tsx"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-XOK6I6U4.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-6BDATJCK.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/document-name.ts"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-XOK6I6U4.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-6BDATJCK.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/src/app-layout.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/product-combobox.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/api-client-react/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/card.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/button.tsx"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/select.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/dialog.tsx"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/lucide-react.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/api-error.ts"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/lib/number-format/src/index.ts?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/campo-escaneo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/internal-navigation.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/permisos.ts"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/hooks/use-toast.ts"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/textarea.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/ui/password-input.tsx"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/document-name.ts"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/utils.ts"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-label.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-select.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/@radix-ui_react-dialog.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/date-fns.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo-monochrome.png?import"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/confirmacion-texto-exacto.ts"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-6BDATJCK.js?v=b990b60e"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-XOK6I6U4.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/document-name.ts"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-EYRZ3RSY.js?v=b990b60e"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/document-name.ts"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/assets/mariana-textil-logo.png?import"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/lib/document-name.ts"
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
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/brand-logo.tsx"
    },
    {
      "method": "GET",
      "url": "http://127.0.0.1:4193/@fs/home/runner/workspace/artifacts/mariana-textil/src/components/document-qr-code.tsx"
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
      "url": "http://127.0.0.1:4193/node_modules/.vite/deps/chunk-FNHC6X6J.js?v=b990b60e"
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
      "sha256": "09def79b4639be7bfadc492137a5011335dfcde4e198f6722db0340e828fdf56",
      "bytes": 84276
    },
    "artifacts/mariana-textil/src/components/campo-escaneo.tsx": {
      "sha256": "5f434a5c43d37cc5a90f5b5a4a0eaedc564d6c39a078e91af62f46eb6e15ec32",
      "bytes": 12891
    },
    "artifacts/mariana-textil/src/pages/ticket-detail.tsx": {
      "sha256": "2f9fd2e79d63463c4a39f9a951b67b0e393426da8f79c0910058d14664f3a226",
      "bytes": 52152
    },
    "artifacts/mariana-textil/src/pages/cobros.tsx": {
      "sha256": "acd460c8cbefa247032bd273f8c7ee11a3a679a9d7ddfd23862ae0e0b492f0a2",
      "bytes": 88878
    },
    "artifacts/mariana-textil/src/pages/producto-detail.tsx": {
      "sha256": "38e7d01c155f930c7ce08aa01fce754eeabaabe933276a03382d928333a50697",
      "bytes": 45605
    },
    "artifacts/mariana-textil/src/pages/ajustes.tsx": {
      "sha256": "8259ce3a203be14932ff78b49382c2098fd9790e99c4d9c421baf873369f1b9b",
      "bytes": 30362
    },
    "artifacts/mariana-textil/src/components/cliente-nota-credito.tsx": {
      "sha256": "842add8e2bd40ed878820563c30b1658fbc4d20790551f4232e43be654ad9731",
      "bytes": 18834
    },
    "artifacts/mariana-textil/src/components/cliente-nota-estado-badge.tsx": {
      "sha256": "866b5eb451c4f829ccaaa25d4858414c8230af25d753bdcc2804eaf568055d90",
      "bytes": 2106
    },
    "artifacts/mariana-textil/src/lib/document-name.ts": {
      "sha256": "2818772baf6943de45be0ecfbf49b5cefc5418b69238e9522b4c9ff113540497",
      "bytes": 2161
    },
    "lib/number-format/src/index.ts": {
      "sha256": "94b2be43d275796cbeb3be209541ceaabb4a9c085dcc1ed4d8f0cfc4551db60a",
      "bytes": 5787
    }
  }
}
```
