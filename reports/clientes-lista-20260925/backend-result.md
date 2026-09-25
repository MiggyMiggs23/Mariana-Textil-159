# Backend listo; no liberado ni reiniciado

Se añadió GET `/api/clientes/listado` sin cambiar GET `/clientes`.
Contrato y clientes generados desde OpenAPI; validadores de entrada/salida
aplicados. Respuesta limitada a 50 filas (máximo 100), orden y búsqueda globales.

## Semántica

- Nombre por palabras/subcadenas, sin distinción de mayúsculas o acentos.
  RFC por subcadena y teléfono por dígitos, sin exigir signos de formato.
- Un evento por ticket cobrado o nota autorizada en estado VENDIDO; no se vuelve
  a contar su asiento VENTA_CREDITO, ni se multiplican eventos por líneas/pagos.
- ABONO se cuenta una vez y se excluye si tiene REVERSO positivo vinculado.
- Fecha del ticket/nota: cobrado_at/autorizado_at. Si falta evidencia de fecha
  no se inventa la fecha de importación/creación como actividad financiera.
- Última actividad histórica independiente del periodo; conteo por mes,
  tres meses o año móvil en calendario America/Mexico_City, o toda la historia.
- Actividad restringida al sitio autorizado. Abonos usan sitio_origen_id,
  con ticket asociado como respaldo; sin atribución quedan fuera de detalle local.
- Deuda y favor conservan exactamente la proyección FIFO canónica global;
  no se usa el caché saldo_credito ni una suma alternativa. Una lectura masiva,
  sin consulta por cliente.
- Sin clientes_finanzas/ver: actividad null, sin saldos ni límite, orden
  financiero degradado a nombre asc. Guardas de sesión/clientes/ver vigentes.

## Pruebas y rendimiento

`backend-test-proof.json`: PostgreSQL desechable, esquema completo de 108
tablas, 2,575 clientes sintéticos, pruebas positivas de ventas/notas/abonos,
reversos/cancelaciones, periodos, alcance por sitio, deuda/favor, redacción,
búsqueda por nombre/RFC/teléfono, orden inverso, paginación y validadores.
Escala adicional con 50,000 tickets sintéticos: servicio completo 81 ms local.
No se ensayó tráfico HTTP autenticado ni escrituras de negocio.

`performance-readonly.json`: lectura real READ ONLY del catálogo de 2,576
filas (2,575 importadas + cliente interno). Primera lectura completa 557.61 ms;
caliente 35.29 ms; búsqueda Arvizu 26.15 ms; conteo mensual 29.45 ms;
orden por deuda 34.36 ms. Respuesta de 50 filas ~25 KB.
En esa medición la aplicación tenía cero tickets y cero movimientos de crédito:
no se presenta esa lectura vacía como prueba de agregación financiera.
Son tiempos de servicio/SQL, no una garantía de tiempo de navegador o red.

No fue necesario un índice nuevo o un contador persistido para la escala
medida. No se aplicó ni preparó DDL innecesario; no hubo escrituras en la
base de la aplicación. Typecheck backend, codegen y `node --check` aprobados.

## Candidato aislado

`artifacts/api-server/dist-clientes-lista-20260925`.
Fuente retenida: dist-test-reset-protected-customers-20260925.
El cotejo de sourcemaps exige exactamente cuatro diferencias: dos módulos
nuevos, montaje en routes/index y solamente nuevos validadores en generated/api.
No se copió routes/clientes de HEAD ni se liberó el candidato comercial.
Procedencia/hashes: `api-build-provenance.json`, `api-artifact.sha256`.
El propietario/main debe autorizar y realizar el cambio de artefacto y reinicio
inspection antes de activar un frontend que consuma el endpoint.