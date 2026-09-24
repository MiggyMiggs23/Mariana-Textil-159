# Reloj mensual privado — entrega a MAIN y g-month-simulation

Preparado y **detenido**: PostgreSQL exclusivo en
`/home/runner/workspace/.local/tanda-g-ampliada/month-cluster`, TCP 55443.
La copia se llama `tanda_ga_month`; testigo vacío `tanda_ga_witness`.
No se conectó a app DB ni se modificó el clúster compartido 55442.
El archivo disponible es `template.dump` (template sanitizado), verificado contra
el SHA256 de `setup/template-identity.json`; no existe un archivo llamado
`sanitizedtemplate.dump`. Se restauró sin propietarios ni ACL.

## MAIN: arranque persistente

Desde la raíz del workspace, mantener vivo con el wrapper persistente de MAIN:

    node reports/tanda-g-ampliada/tarea-3/clock/launch.mjs postgres

Luego g-month-simulation, no este preparador:

    node reports/tanda-g-ampliada/tarea-3/build.mjs
    node reports/tanda-g-ampliada/tarea-3/clock/launch.mjs harness

El launcher configura un entorno mínimo, credenciales privadas propias, testigo,
preload y el contrato MONTH_* completo; verifica nombre, directorio y puerto.
Credenciales en `.local/tanda-g-ampliada/month-database.json`, modo0600.
**No usar la entrada month de worker-databases.json**, que sigue describiendo
55442. Ninguna URL/contraseña se publica aquí.
El worker debe corregir en su SQL `::text day` a `::text AS day`: PostgreSQL
rechaza DAY como alias implícito. No se modificó su run.ts.

## Mecanismo y límites

Sin libfaketime instalada encontrada; gcc14.3 existente compiló el pequeño C
auditable en esta carpeta. Biblioteca y controlador ejecutable viven sólo en
`.local/tanda-g-ampliada/`. Se interceptan CLOCK_REALTIME,
CLOCK_REALTIME_COARSE, gettimeofday y time; los demás relojes se delegan
directamente al kernel. El controlador acepta ISO UTC `.000Z` y reemplaza
atómicamente un offset privado. El reloj avanza a velocidad real entre saltos.
LD_PRELOAD se inyecta exclusivamente en el postmaster mensual y arnés mensual,
nunca en el entorno global. El controlador usa syscall para leer tiempo real
sin retroalimentación del preload.

**Time travel explícito de prueba**, no evidencia de un mes real transcurrido.
No se cambiaron reloj del sistema, producto, funciones SQL, fechas históricas
ni compuertas. El único grant adicional es pg_read_all_settings al login mensual
para el guard de identidad data_directory; no es superusuario y sólo CONNECT
a su base. No habilita reglas funcionales.

`proof.json` acredita now() PostgreSQL y Date Node en dos fechas consecutivas,
con salto de 86400 segundos y temporizadores monotónicos ~150ms reales.
La prueba usa SELECT, no ejecuta productores ni simulación. Se restableció
2026-09-23T18:00:00.000Z (fecha de sesiones ABIERTA del fixture) antes de detener.
MAIN puede repetir `launch.mjs proof` **sólo antes de la simulación**:
restablece ese instante y no debe usarse contra una ejecución en curso.

`prepare.mjs` es preparación nueva, rechaza un directorio existente. Dos intentos
iniciales se descartaron antes de obtener PASS (alias SQL y permiso de lectura
de settings); no contenían ejecuciones mensuales. No se reusa historia consumida.
Detener sólo este postmaster con pg_ctl -D sobre la ruta exacta anterior;
no utilizar el lifecycle del clúster compartido para este proceso.