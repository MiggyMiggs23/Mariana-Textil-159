# Clientes protegidos en el reinicio

## Semántica

`PROTECT_CUSTOMERS = true`: todos los clientes permanecen. El reinicio conserva
la fila completa excepto `saldo_credito`, caché derivado que se pone en cero.
No cambia nombres, contactos, direcciones, RFC, observaciones, activo/inactivo,
límites, plazos ni fechas del catálogo.

La revisión encontró que `cliente_documentos` **no es una tabla financiera**:
contiene identificaciones INE, vigencia, reemplazos y referencias de archivos.
También queda protegida y el GET de estado la comunica entre lo conservado.
No se tocan los archivos referenciados ni se dejan documentos sin cliente.
Las demás relaciones directas a cliente son operaciones financieras/logísticas
y permanecen en el conjunto de borrado, junto con aplicaciones y trazabilidad.

Tickets/notas, pagos, abonos, movimientos de crédito y toda operación financiera
se vacían: deuda e importe a favor derivados del ledger quedan en cero.
No se ejecutó ningún reset ni escritura en la base de la aplicación.

## Prueba desechable

Comando: `pnpm --filter @workspace/api-server exec tsx --test src/lib/test-reset/*.test.ts`.
Resultado: tres pruebas aprobadas, incluida PostgreSQL real aislada con esquema
completo, HTTP/auth y exclusión multiproceso. Se crearon clientes con todos sus
campos, distintos límites, activo/inactivo, dos INE y notas/pagos; ledger con
deuda +500 y abono/saldo a favor -250, con todos los triggers reales activos.
Se ejecutó el reset **sin override**, usando el default protegido del producto:
- los tres clientes (incluido el interno) permanecieron;
- perfiles completos y documentos idénticos a las instantáneas anteriores;
- 77 tablas operativas vacías, ledger y cachés cero, sin documentos huérfanos;
- historial protegido del reset registra `protected_customers=true`;
- límites 900/4500 y plazos 30/45 conservados;
- rollback, contadores, creación posterior de entrada/rollo/ticket y relogin siguen pasando.

Evidencia: `tests.log`, `typecheck.log` (PASS).

## Candidato para activación por MAIN

`artifacts/api-server/dist-test-reset-protected-customers-20260925`.
Se reutilizó el build aislado basado en el bundle retenido, no HEAD.
`source-delta.json` demuestra solo tres fuentes de producto diferentes respecto
del bundle activo anterior: manifiesto, servicio y GET de estado del reset.
La única diferencia en dependencia Pino es la ruta de workers del nuevo directorio.
`build-inputs.json`, `build.log` y `api-artifact.sha256` conservan procedencia/hash.
No se cambiaron workflows ni se arrancó/reinició API durante la preparación.

## Activación realizada

La API ya sirve este candidato con `PROTECT_CUSTOMERS=true` y verificación
de hashes antes de arrancar. Se conservaron inspection boot y la exclusión
de procesos. Frontend existente: el diálogo consume la protección del servidor.
Salud HTTP 200 y workflows API/web en ejecución.

Los censos de solo lectura `activation-before.json` / `activation-after.json`
compararon las 108 tablas de la aplicación sin diferencias de conteos ni
huellas de contenido. No se ejecutó el reset en la base de la aplicación.