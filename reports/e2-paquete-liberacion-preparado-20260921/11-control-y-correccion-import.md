# 11. Control real y corrección mínima de importación

**Estado final: control PASS, candidato anterior FAIL, candidato corregido
PASS real. Paquete preparado y validado, NO liberado; fase B no otorgada.**

## Control causal exigido por el propietario

El agente principal ejecutó el mismo runner corregido, fixture vacío+A+C,
INSPECTION, puertos 55439/18092 y verificación de preflight para ambos:

| Revisión | Resultado real | Limpieza |
|---|---|---|
| 7cb77f8, directorio de control | healthz 200, workers reales, INSPECTION y catálogo/filas/secuencias sin cambios | candidato detenido, PostgreSQL stop 0, directorio destruido |
| 31804125 con overlays autorizados anteriores | preflight PASS explícito en log, aviso INSPECTION, sin healthz 200 a 30 s | candidato detenido, PostgreSQL stop 0, directorio destruido |

Evidencia: `verificacion-control/` y
`verificacion-final/failed-start-after-preflight-fix/`.
El primer fallo previo al arreglo del preflight permanece separado en
`verificacion-final/failed-start-20260921-212811/`.

La condición de la autorización `autorizacion-control-y-preflight.txt` se
cumplió: arranca el retenido, no el candidato. No se atribuye la regresión al
ciclo de fuentes antiguo por sí solo.

## Delta concreto y mecanismo

`git diff 7cb77f8 31804125 -- lib/db/src/index.ts
artifacts/api-server/src/lib/inventario.ts
artifacts/api-server/src/lib/salida-venta-reservation.ts` no muestra cambios.
Ni el ciclo inventario/reserva ni los top-level awaits de DB son nuevos.

El delta relevante está en `artifacts/api-server/src/index.ts`: se retiró
la importación estática de app/requestDrain y se añadió `await import("./app")`
después del gateway. Eso cambió cómo esbuild empaqueta el grafo HTTP:

- Control retenido: grafo eager, sin init_app, init_inventario ni
  init_salida_venta_reservation encapsulados en `__esm`.
- Candidato anterior: grafo lazy y esos inicializadores async; inventario
  espera reserva y reserva vuelve a esperar inventario.
- Candidato corregido: desaparecen de nuevo esos tres wrappers, igual que
  en el control. Los módulos de inventario/reserva/DB no se modificaron.

Hashes y comparación estática del control/antes/después en
`verificacion-final/import-initializer-comparison.json`. La confirmación
dinámica de este cambio mínimo quedó confirmada por el arranque real corregido:
healthz 200 con la misma base vacía, configuración y controles del ensayo.

## Corrección separada, no eliminación arbitraria del ciclo

Commit **226509cae4d6e850782763a0f4d15139ddedd568**, solo dos archivos:

1. `src/index.ts`: restaura la importación estática original de app/requestDrain
   y retira su importación lazy. Mantiene intactos modo, flags, preflight
   limitado, consulta INSPECTION, inicializadores, guards y orden de listen.
2. `src/lib/limited-startup-preflight.test.ts`: exige grafo eager y gateway
   antes de listen; mata una regresión a importación lazy además de los mutantes
   de listen prematuro, writers y fallthrough de inicializadores existentes.

La garantía es ahora preflight antes de **escuchar**, no antes de importar
el grafo HTTP. Se conserva el grafo eager que pasó el control sin escrituras.
La prueba existente de ausencia de mantenimiento automático del session store
continúa aprobando. No se habilita captura, devolución ni ninguna puerta E2.

Regresión sin base sobre fuente real: exit 1 antes, exit 0 después. Una primera
redacción del comentario contenía el token que el test busca para listen y
produjo una colisión textual; se conservó su log y se corrigió únicamente el
comentario antes del commit. No se ocultó un error de runtime.

## Compilación y conservación

Antes de recompilar se confirmó que no había proceso del candidato. La copia
completa anterior, incluidos mapas/workers/fonts, permanece en
`candidato-antes-fix-import/`, índice SHA-256
`1102baeec9de7d7c7773f142a835f39234ec1ba2f278373cdedcd4814ff2feb3`.
Las expectativas y wrapper usados por ese intento también están archivados
junto a su evidencia.

Se recompiló desde la misma exportación exacta, con el overlay de este commit
y entorno limpio, en el mismo directorio final autorizado:
`artifacts/api-server/dist-e2-20260927`.
Nuevo índice SHA-256:
`008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`.
1,261 archivos API/lib coinciden con los blobs/overlays declarados; cero
diferencias no autorizadas. No se compiló desde HEAD arbitrario.

Typecheck raíz: todos los paquetes PASS, cero errores. Selección explícita
offline: 119/119 PASS. Wrapper: 9/9 PASS; regresión CLI symlink adicional PASS.
Hashes del paquete y wrapper se fijaron nuevamente al candidato corregido.
El preflight exige prueba positiva real; su corrección independiente sigue
siendo af48ed59696d34ab1f6d8c65df61c53a0f614f1f.

## Resultado final obtenido por el agente principal

El runner habitual, sin --control, pasó con el candidato corregido y el mismo
fixture aislado: preflightProofObserved true, health 200/status ok, workers
thread-stream/pino-pretty, INSPECTION y catalogRowsSequencesUnchanged true.
candidateStopped true, postgresStopExit 0 y disposableDestroyed true acreditan
la limpieza. Resultado, traza, log y auditoría están en verificacion-final.
El subagente no ejecutó la aplicación. El manifiesto y texto de fase B están
finalizados para revisión/autorización futura, no para ejecución automática.
El dist activo permanece intacto, con SHA-256
`3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.