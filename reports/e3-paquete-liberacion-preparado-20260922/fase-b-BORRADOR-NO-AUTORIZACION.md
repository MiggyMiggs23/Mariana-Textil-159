# Fase B — BORRADOR, NO AUTORIZACIÓN

**Este texto no ha sido autorizado ni ejecutado. No libera E3.**

La eventual fase B debe dividirse expresamente:

1. **Preparación de esquema y servicio CLOSED:** ventana sin escritores,
   respaldo completo y restauración verificados, preflight B0, aplicación
   exacta y única de `01-install-prepared.sql`, postflight B1 y arranque con
   `API_INSPECTION_BOOT=1`, E3 OFF, E3 dirigido OFF y remate OFF. Esto no abre
   captura ni retira la guarda E1.
2. **Apertura de efectivo y E3:** queda fuera de este borrador. No autorizar
   automáticamente `03-prepare-ordinary-cash-gate-retirement`, no ejecutar 04
   y no cambiar E3 a ON.

Antes de cualquier autorización futura, el propietario deberá resolver
expresamente si abre la captura ordinaria de efectivo/SQL 03. Además hay un
bloqueo técnico independiente: aunque la decisión “recaptura solo ADMIN” ya
está resuelta, las rutas de recaptura usan el permiso
`clientes_recapturas/crear` sin veto ADMIN explícito. Se debe implementar y
probar exclusividad ADMIN incluso otorgando ese permiso a otro rol. La matriz
en falso y `E3_ENABLED=false` cierran hoy el flujo, pero no prueban que una
apertura futura sea segura.

Una autorización futura válida tendría que fijar, sin campos implícitos:

- revisión fuente `95128fc8f2773907c6a34ef2cfeb1f631e84f301`;
- `manifest.json` y su SHA-256;
- bundle API final y hash
  `753a9996b7249ff6227787318f5e6d0b929fd712dd4cd4e068ee8275f636d942`;
- frontend final, inventario `release-assets.sha256` y sus hashes;
- identidad y expectativas B0/B1 exactas de `release-expected.json`;
- fecha, hora, operador, timeouts, ausencia de escritores, respaldo y plan de
  aborto;
- alcance explícito: solo esquema + CLOSED, o una autorización posterior
  separada para apertura después de cerrar el bloqueo técnico.

La evidencia que se someta con una autorización futura debe conservar la
comparación antes/después de catálogo, secuencias (`last_value` e `is_called`)
y hashes canónicos de **todos los valores de todas las filas por tabla**, no
solo conteos. El ensayo de este borrador verificó 74/74 tablas y probó la
sensibilidad cambiando una fila con el mismo conteo después de detener el
candidato, exclusivamente en la base desechable luego destruida.

La política de append de auditoría sigue siendo la aprobada para E2: un fallo
produce `WARNING`, no bloqueo automático. Esto no permite declarar verde un
ensayo sin registro: el arnés exige una entrada efectiva con PID del bundle en
ejecución, hash, modo y preflight correctos. No se autoriza cambiar esa política
a fail-closed mediante este borrador.

Sin ese texto posterior, el paquete permanece **CLOSED, PREPARADO, NO
LIBERADO**. Este borrador no permite reiniciar la API real, aplicar SQL,
modificar workflows, habilitar flags ni ejecutar 03/04.