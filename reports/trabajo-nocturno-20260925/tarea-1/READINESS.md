# Tarea 1 — candidato ensayado; aplicación y servicio pendientes de MAIN

## Actualización final de fuente — 2026-09-25

- E5 general frontend/backend ON tras ensayo positivo PostgreSQL. Refund sigue
  `E5_REFUND_ENABLED=false`; E12/Fondo/atribución histórica no fueron abiertos.
- Fuente actual: 122/122 pruebas E5+E11, 6/6 contratos pagos-dirigidos.
  Mutante aislado refund ON: 3 fallos/51, restauración 51/51.
- `positive-final-source.log`: clúster canónico propio, ADMIN del seed, recepción
  única → rechazo → repropuesta → aplicación parcial → preparación A →
  aplicación final ADMIN; una recepción, dos aplicaciones, pendiente final cero.
  Refund y cambio del destino original rechazados. Clúster destruido.
- `fixture-before.png` / `fixture-after.png`: componente productivo React en
  fixture sintético aislado. Revisado visualmente; NO es login ni API autenticada.
- Builds candidatos PASS: `artifacts/api-server/dist-night-task12` y
  `artifacts/mariana-textil/dist-night-task12`. No arrancados por este trabajador:
  MAIN controla arranque/reinicio y health200 del candidato servido.
- Pool efectivo inspeccionado por `/proc/192/environ` sin imprimir secretos:
  `effective-api-pool.json`, heliumdb/postgres, socket Unix, directorio
  `/var/lib/postgresql/data`, inicio `2026-09-25T03:40:41.478Z`.
  Nueve cierres E5, ocho E11, cero CONTADOR y cero perfiles. Sólo lectura.
- `effective-pool-operator.mjs inspect PID` repite sólo lectura.
  Modos `apply-task1 PID expected.json` y `apply-task2 PID expected.json` son
  exclusivamente para MAIN tras revisión; verifican identidad, PID, inventario
  y cierres refund/banco. Nunca imprimen URL o entorno; nunca asignan perfiles.
- Separación de commits: MAIN puede revisar/aplicar al índice
  `source-task1-only.patch` (cinco archivos E5, A todavía OFF en ese parche),
  después tarea 2 agrega cuatro archivos E11 y habilita sólo el flag compartido A.

**No se aplicó SQL a appDB.** La apertura E11 requiere las dos correcciones
SQL adicionales descritas en tarea 2, además de retirar sus cierres. MAIN debe
revisarlas antes de liberar. No se acredita la suite HTTP legacy
`pagos-dirigidos.integration.test.ts` ni health del nuevo bundle aún.

## Registro anterior (conservado como historia; flags y pendientes superados arriba)

## Hallazgo y cambio implementado

Abrir el booleano E5 original habría abierto también DEVOLVER. Se separó
`E5_REFUND_ENABLED=false`, comprobado en el comando financiero antes de acceder
al repositorio, en capacidades y en la ruta de opciones de devolución.
E5 general y ContadorA **siguen OFF** hasta revisión de MAIN. No se modificó UI.
La propuesta y la aplicación también rechazan destinos que no pertenecen a
las notas/movimientos indicados en la recepción, incluso para ADMIN.

## Identidad y SQL

`preflight-readonly.json` conserva la lectura actual de la conexión Replit:
heliumdb/postgres, E5 y E11 instalados, nueve cierres E5 y ocho cierres E11 activos.
No se consultaron datos personales ni se autenticó una sesión. Neon devuelve
neondb sin estos sidecars; no equivale a la conexión efectiva de la API.
MAIN debe cotejar la identidad del pool servido; el PID observado fue 192,
bundle dist-tanda-h-entry-guard.

El informe previo decía que **la corrección** E5 no se había aplicado:
no significa que falte el esquema E5. Reinstalar el SQL base sería incorrecto.
La comparación actual del cuerpo instalado contra el preparado resulta idéntica:
la corrección de aliases ya está presente en esta identidad, aunque el informe
histórico decía pendiente. `prepare-sql.mjs` exige esa igualdad, por lo que NO
reemplaza funciones. `01-candidate-not-approved.sql` sólo
retira siete cierres generales; conserva íntegros los cierres de devoluciones
y salidas bancarias. No altera E1, Fondo, E12, permisos ni historia.
Verifica el hash de la función instalada antes de retirar los cierres.

## Evidencia obtenida

- Unitarias E5: 50/50; `unit-green.log`.
- Mutantes de apertura indebida de refund y cambio del destino recibido,
  únicamente en copia física local: fallan tres obligaciones; restaurado
  50/50. No se mutó fuente viva.
- SQL en clúster PostgreSQL nuevo sin usuarios ni datos financieros:
  candidato aplicado, devolución rechazada, mutante que elimina su cierre
  detectado y rollback/restauración comprobados. Clúster destruido.
- `sql-rehearsal.log` **NO acredita el ciclo financiero positivo**.
- Base Git exacta y SHA-256 de los cuatro archivos cambiados conservados
  en `base-commit.txt` y `source.sha256`; no hay commit propio.

## Pendiente / barreras para MAIN

NO aplicar aún este candidato a la app: falta ensayo positivo con repositorio
real y población autorizada, SQL revisado y cotejo de pool efectivo.
El arnés histórico run-e5-e7-isolated-tests.mjs inserta un ADMIN sintético fuera
del seed y ejecuta refund positivo; no fue reutilizado sin adaptar ambas cosas.
También faltan capturas antes/después en disposable, prueba HTTP autenticada,
suite pagos-dirigidos, flags de apertura y healthz del candidato.
No se arrancaron procesos de app, workflows ni sesiones; ninguna escritura
en base de aplicación. Esta preparación no se presenta como liberación.

La captura `served-login-reference-not-disposable.jpg` es sólo referencia
sin autenticación del preview ya servido: muestra «Comprobando sesión…».
No es captura del candidato, no es ensayo disposable, ni acredita login,
estado sano del candidato o recorrido financiero. La vista disposable no
estaba arrancada; el estado del trabajador T5/T6 indica que MAIN debe hacerlo.