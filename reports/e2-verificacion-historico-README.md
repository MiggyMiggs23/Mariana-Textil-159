# E2 — Operador histórico sololectura (preparado, NO ejecutado)

Archivo: `scripts/src/e2-historical-readonly.ts`.

## Alcance e inyección del lector real

El operador no importa `@workspace/db` raíz, inicializadores ni credenciales desde archivos. No crea usuarios, sesiones ni fixtures. No ejecutarlo hasta revisión explícita del agente principal y confirmación del alcance permitido. La preparación del archivo no implica autorización para conectar.

Antes de conectar, el modo capture verifica con esbuild el grafo runtime del lector real `lib/caja-corte-reader.ts`, sin escribir bundle ni ejecutarlo. Un import runtime de `@workspace/db` raíz, pg, entrypoint API/DB o módulos de red hace fallar el preflight. Los imports exclusivamente de tipos desaparecen. El core debe usar tablas de `@workspace/db/schema` y el tipo db separado. Si ese cambio no está presente, **el operador se detiene antes de conectar**.

Tras preflight, importa el export real `readSessionCash`, crea Drizzle con el `pg.Client` ya abierto en READ ONLY y pasa ese lector inyectado, sin pool ni startup. Por cada fila/superficie cerrada compara esperado, diferencia y predicado contra el SQL legacy **en la misma transacción REPEATABLE READ**, evitando drift temporal entre ambas lecturas. No reemplaza la resolución legacy/snapshot E2 ni su consulta real de auditoría con una implementación duplicada. Registra hashes de fuentes del grafo revisado, filas de salida canónicas y diferencias por ID/superficie/campo.

Este grafo es un control adicional, no un sandbox contra código arbitrario: revisión humana antes de ejecutar sigue siendo obligatoria. No debe editarse código durante una captura. Drizzle se resuelve desde las dependencias de API, pero nunca importa la aplicación.

## Protocolo, únicamente después de revisión

Desde raíz, con `DATABASE_URL` ya configurada por el entorno (no imprimirla):

```sh
pnpm --filter @workspace/scripts exec tsx src/e2-historical-readonly.ts capture E2_READ_ONLY_REVIEWED reports/e2-historico-antes.json
# Después del cambio de código, sin reiniciar API ni provocar escrituras:
pnpm --filter @workspace/scripts exec tsx src/e2-historical-readonly.ts capture E2_READ_ONLY_REVIEWED reports/e2-historico-despues.json
pnpm --filter @workspace/scripts exec tsx src/e2-historical-readonly.ts compare reports/e2-historico-antes.json reports/e2-historico-despues.json reports/e2-historico-comparacion.json
```

- `capture` es el único modo con red. Configura `default_transaction_read_only=on` desde conexión, `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, UTC, DateStyle ISO y timeouts. Confirma ambas configuraciones read-only. Termina con ROLLBACK, jamás COMMIT. Únicamente SELECT, cursor de SELECT y configuración transaccional; las consultas Drizzle usan el mismo cliente/transacción.
- Sin argumentos solo muestra ayuda; `compare` no lee credenciales ni conecta. Ambos snapshots deben existir: no captura implícitamente.
- Archivos JSON exclusivamente dentro de `reports/`, escritura exclusiva sin sobrescribir, modo 0600. No incluyen nombres de clientes/usuarios, motivos, referencias ni documentos completos. Identidad DB es hash no secreto de nombre/oid/servidor/puerto/versión; un cambio de endpoint o versión detiene conservadoramente la comparación. No certifica identidad física de un cluster clonado idéntico.
- Metadatos: commit y indicador de árbol sucio, hash del operador y SQL, timestamp/snapshot PostgreSQL y configuración read-only. Un commit con árbol sucio no identifica por sí solo la revisión final; repetir sobre revisión definitiva para evidencia de entrega.
- Filas legacy contienen únicamente ID de sesión, fechas y cifras por superficie. Fechas y numéricos se convierten a texto **en PostgreSQL**, nunca mediante `Date` cliente. La salida monetaria del lector nuevo también se canoniza en SQL.
- Detalle conserva exclusión de CANCELADO; historial/admin exigen VENDIDO; detalle/historial restan salidas físicas; admin no. Se preservan explícitamente pertenencia a listado, diferencia y predicado de diferencia. No se homogeneizan históricos.
- Conteos/hashes cubren tablas financieras completas y auditoría. Serialización `to_jsonb(row)::text`, orden COLLATE C y framing JSON por fila; cursor por lotes evita transmitir filas completas al informe. Incluye datos personales solo dentro de memoria para hash, nunca los guarda. No se sustituyen hashes por objetos decodificados por distintos clientes.
- Las lecturas y ordenamientos completos pueden ser costosos: revisar tamaño y ventana operativa; timeout falla cerrado. Cambios legítimos concurrentes, incluidos nuevos cierres, provocan drift: no atribuir automáticamente a E2 ni aceptar descartando filas.
- No se comparan aún rutas de filtros combinados/paginación/totales administrativos, impresión ni UI. Sí se compara el lector real de efectivo por fila y superficie con la baseline legacy, incluida su rama de auditoría `CERRAR_CAJA`.
- Formato v2: no mezclar snapshots del operador inicial v1. La captura conserva baseline legacy completa, hashes/contadores y resultado del lector en un solo JSON. Antes/después conserva además evidencia frente a cambios de almacenamiento. No sobrescribir el snapshot antes.
- Salida 0 de capture: todas las filas cerradas coinciden con legacy mediante el lector real en la misma transacción. Salida 1: mismatch/error. Salida 2: cero filas cerradas, no evidencia positiva. Salida 0 de compare: snapshots, tablas y lectores conservados; **no significa aceptación integral E2**.
- Una sesión E2 cerrada cuyo snapshot contenga sumandos inexistentes en legacy puede diferir legítimamente de esas fórmulas. Este operador es para el universo histórico preexistente; no convertir discrepancias a éxitos silenciosos ni homogeneizar admin. Revisar cualquier mismatch.

Sin ejecución DB, sin resultados de conservación ni pruebas de concurrencia declarados.