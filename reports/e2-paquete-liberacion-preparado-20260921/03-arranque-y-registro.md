# 3. Arranque y registro en el mismo reinicio

**Procedimiento de liberación futuro.** Se prepararon nuevas copias de wrapper,
registrador y preflight en este paquete; ver documento 08 y manifest-final.json.
Sus pruebas aisladas pasaron. No se modificó el workflow, sus variables,
los scripts antiguos, el preflight retenido ni el bundle activo. La ejecución
real del candidato queda para el agente principal según su alcance.

## Punto de partida

`scripts/api-start-audit.sh` está preparado pero no conectado al workflow.
Comprueba el hash del preflight retenido, el del bundle antes y después del
preflight, exporta `API_INSPECTION_BOOT=1 NODE_ENV=development`, ejecuta el
preflight y hace `exec node --enable-source-maps artifacts/api-server/dist/index.mjs`.

Sus hashes están fijados a los artefactos anteriores. Ejecutarlo sin adaptarlo
no es un mecanismo de liberación del bundle nuevo. Cambiar solo un hash tampoco
resuelve el nuevo contrato de catálogo/identidad.

## Requisitos de preparación antes de pedir GO

1. Compilación aislada autorizada y selección del bundle por su hash.
2. Preflight nuevo versionado, completo para el estado CLOSED post-DDL.
3. Wrapper versionado que apunte exactamente a esos artefactos. Mantener controles
   de hash antes del preflight y antes del exec. No build ni migración dentro
   del comando de arranque.
4. Revisión del registrador y política de fallo de logging; validación aislada
   autorizada, sin usar la API para ensayar.
5. Manifiesto y texto de autorización completos, incluidos modo y destino de
   workflow. No ampliar automáticamente al comando de producción ni publicar.

## Modo elegido: INSPECTION con preflight externo completo

El propietario eligió INSPECTION; no se cambia a EXPLICIT_LIMITED. Como
referencia técnica, ambos modos no-normales pausan inicializadores, DDL automático,
backfills y monitor. **No significan API de negocio completamente READ ONLY**:
sus rutas, incluido el cierre, siguen requiriendo control operativo.

- **INSPECTION + preflight externo completo:** continuidad del selector
  `API_INSPECTION_BOOT=1`. El código interno solo hace `SELECT 1`; por eso el
  nuevo preflight externo debe cubrir toda la liberación antes de importar el
  bundle. Exportar variables en la misma shell, no confiar solo en metadata.
- **EXPLICIT_LIMITED con guardState CLOSED:** requiere
  `API_STARTUP_MODE=EXPLICIT_LIMITED` y un approval JSON válido del contrato
  `e2-limited-readonly-v3`, identidad/digest y fingerprints exactos. No combinarlo
  con `API_INSPECTION_BOOT=1`. Los planes referenciados no son permiso para
  ejecutar la apertura LIMITED. El preflight de este modo no reemplaza
  automáticamente las comprobaciones externas completas de este paquete.

No se elige modo hoy. Si se usa EXPLICIT_LIMITED, el wrapper y el registrador
actuales también requieren adecuación: hoy el registro solo guarda
`NODE_ENV` y `API_INSPECTION_BOOT`, no acredita ese selector ni su approval.
No volcar el JSON ni secretos; registrar una identidad no sensible del contrato.
Modo `normal`, defaults ambiguos o combinaciones inválidas: **STOP**.

## Conexión al workflow y único arranque de liberación

Después de DDL/postflight aprobados y con la ventana autorizada:

1. Conservar el artefacto retenido y las evidencias; instalar únicamente los
   archivos del manifiesto aprobado.
2. Actualizar el servicio API existente mediante el mecanismo de configuración
   del proyecto. No crear otro servicio/API en paralelo.
3. El comando deberá fijar raíz de trabajo y entrar al wrapper, conceptualmente:

   ```text
   cd /home/runner/workspace && exec bash scripts/api-start-audit.sh
   ```

   Esto es una forma documental del comando, **no lista para usar con el wrapper
   actual**. Las rutas, hashes, exports y preflight deberán ser los ya aprobados.

4. Reiniciar una sola vez para liberar: el primer intento de arranque del bundle
   nuevo ya pasa por el logger. No arrancar primero y conectar el registro después.
5. Si el hash/preflight falla, no importar la API. Conservar el intento fallido,
   detener la liberación y no recalcular expectativas/reintentar automáticamente.

No cambiar workflows ahora. El alcance de una futura autorización debe
identificar el servicio `artifacts/api-server: API Server` y no implicar
publicación o modificación de otros servicios.

## Lo que el logger acredita y lo que no

`scripts/api-start-audit-record.mjs` hace append de una línea JSON en
`reports/arranques-api.log`, modo de creación 0600; no trunca/rota ni reintenta
un append parcial. Registra UTC, PID y rol, hash calculado del bundle, modo
limitado a los campos actuales, fase, estado/código del preflight y salida
antes de exec. Evita volcar entorno, argumentos, salida SQL y excepciones.

- `preflight_hash`, `bundle_hash_before`, `preflight`, `bundle_hash_after`
  distinguen fallos previos.
- `exec_attempt`, `api_exec_attempted=true`, `pid_role=exec_target` acredita
  **intento**, no que Node llegó a escuchar ni que la aplicación quedó saludable.
- El registro actual **no incluye hash/revisión del preflight ni del wrapper**:
  conservarlos en el manifiesto y en evidencia externa; no afirmar que la línea
  ya los guarda.
- Si falla el append, el wrapper actual advierte y continúa (fail-open del
  logging; las compuertas de hash/preflight siguen vigentes). El propietario
  debe decidir si acepta esa política o exige impedir el arranque sin registro.
  Cambiarla requiere código, pruebas y revisión adicional, no una decisión
  implícita de este documento.

El log local no acredita por sí solo custodia duradera, protección contra un
propietario del filesystem ni historial de reinicios anteriores. Aprobar
ubicación/custodia/retención y acceso; no subir logs automáticamente.

Después del intento, cotejar PID real, hash del archivo ejecutado, modo
inequívoco en salida runtime, escucha/salud y ausencia de inicializadores
escritores. El preflight externo y un `exec_attempt` exitoso no sustituyen
esas comprobaciones.