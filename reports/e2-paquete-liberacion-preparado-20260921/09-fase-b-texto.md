# Fase B — NO AUTORIZABLE / BLOQUEADA / STOP

**El texto siguiente se conserva solo como borrador histórico, no apto para
firma ni ejecución. NO basta llenar la hora.** El arranque real falló: no
healthz 200, ciclo de inicialización async antes de listen y preflight del
runner omitido por el guard CLI ante symlink. Los workers sí cargaron; candidato
y PostgreSQL quedaron detenidos y la base desechable destruida. Las pruebas
independientes 19+8+119 no convierten este recorrido en aprobado.

Ver `10-fallo-arranque-real.md` y su rectificación: la causa de la espera sigue
pendiente de control porque el ciclo de fuentes preexistía. La nueva autorización
permite control 7cb77f8 y corrección independiente de preflight, ya aplicada.
El control real pasó y el candidato anterior falló; se aplicó el fix mínimo
condicional `226509cae4d6e850782763a0f4d15139ddedd568`. No se habilita fase B
antes del arranque real del candidato corregido; cualquier cambio exige actualizar
el manifiesto y los hashes de este borrador antes de reconsiderar fase B.

> Autorizo la liberación E2 CLOSED el domingo 27 de septiembre de 2026,
> a las ______, hora local de Mariana, en una ventana sin escritores.
> El operador es el agente bajo supervisión del propietario; el primer cierre
> lo realiza exclusivamente el propietario en Mariana con tickets de prueba
> en efectivo y transferencia. Los datos de prueba se tratarán en la purga
> final autorizada por separado, nunca mediante borrados en esta ventana.
>
> La fuente es 31804125a1e752bde128d72e9fd44d23972ffff1, con únicamente
> la superposición de tests 07cc804a35b6bba7f3ed640129231ba7434a8767 y el cambio
> de directorio del build e0f1c227e013c59987c06604e21a8036e73c82a5.
> Se añade únicamente la corrección de importación eager y su regresión,
> commit 226509cae4d6e850782763a0f4d15139ddedd568.
> Se acepta el arrastre enumerado: E8, E6 y el atajo de cantidades por rollo
> en Entradas. Remate, precio mínimo y borrado de producto permanecen apagados.
> No se instala frontend ni se copia el workflow de la revisión fuente.
>
> El bundle se ejecuta sin moverlo desde
> /home/runner/workspace/artifacts/api-server/dist-e2-20260927/index.mjs,
> SHA-256 008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5.
> No sobrescribir ni mover el dist retenido.
> El manifiesto de todos los workers/mapas/fonts y entradas de preflight es
> reports/e2-paquete-liberacion-preparado-20260921/release-assets.sha256,
> SHA-256 2f62ecdcd6e2127f8724e42fbb0a1e81205479219ed1ccd69eef7dc5f1798be1.
>
> El wrapper será
> reports/e2-paquete-liberacion-preparado-20260921/api-start-audit.sh,
> SHA-256 58ffd38c057f40ef4fbe9b8f50cad20aadfc4a3612e2060184c81f4b5ef7480f.
> El preflight será release-preflight.mjs del mismo directorio,
> SHA-256 463287fb115c59c0cec4654a264f13a75e0ddd6c9d3adcd7db42047435df9139,
> con release-catalog.sql
> a8b69c5818e2f30e647df10eecd5b57711c50794aeaccc51ba79ff497225bdea
> y release-expected.json
> 990c85fdd6251d6d0f55b62bb0f9a2b4afb3c3fe35468dc12ea6ec8708077ca6.
> El registrador será api-start-audit-record.mjs,
> SHA-256 167f1c342f91e79e16686937844b44856bec7dec3606cba09bb5e19fdb228f98.
>
> El destino lógico es heliumdb, OID 16384, public, rol postgres,
> PostgreSQL 160010, usando exactamente la DATABASE_URL del runtime aprobado.
> Exijo preflight B0 antes de SQL y B1 después, sin aceptar por nombre solamente.
> B0 catálogo: 37f6af5a2e06748a8499b995caeec072770090c36f2ad741d35c65953421bec8.
> B1 catálogo: 89c445d53c3db7d8cb3a45bdab49f82acb12943d62084eced21ab3af5cf5a358.
> Si la identidad o cualquier expectativa no coincide, detener sin reparación.
>
> Antes del SQL, exijo respaldo completo verificado en Google Drive,
> descarga/restauración de ensayo y conservación del bundle retenido y sus
> dependencias, siguiendo el procedimiento del 13 de septiembre. Sin esas
> evidencias no se aplica SQL ni se continúa. El bundle retenido conserva
> SHA-256 3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98.
>
> SQL exacto, en el directorio sql del paquete:
> instalación 01-install-evidence-prepared.sql,
> 3360d2b7edea27342cc073a7d6f864690dfb677f73dd3a0d57de46a522120a7c;
> postflight 03-preflight-schema-prepared.sql,
> b368c7239f83b088d1fa5c30d1c1d0dd08538842d18a694315bd88b7f1e5980c.
> La reversión excepcional 02-revert-before-capture-only.sql tiene hash
> 0f5952b874bb9fead4f782b9b169636564d302f00f20d5e4bf135896c9b32b3c;
> solo se usa bajo las condiciones de recuperación del documento 08.
> No ejecutar el SQL de devolución ni abrir sus puertas.
>
> El arranque se hará desde la raíz del workspace mediante
> bash reports/e2-paquete-liberacion-preparado-20260921/api-start-audit.sh,
> en el workflow de API existente y su puerto operativo, no el puerto de prueba.
> El modo es INSPECTION con API_INSPECTION_BOOT=1 y NODE_ENV=development.
> No cambiar a modo normal, correr inicializadores/backfills ni abrir captura,
> devolución, retenidos, atribución o Fondo. Un fallo de append de auditoría
> no bloquea el arranque; un fallo de hashes o preflight sí lo bloquea.
>
> Exijo verificación posterior de hashes, modo efectivo, workers, healthz y
> ausencia de escrituras de arranque. Antes de nuevos snapshots la recuperación
> puede volver al bundle retenido únicamente tras verificar B0 y la reversión
> segura. Después de un snapshot nuevo se conserva su auditoría y una versión
> E2 CLOSED compatible; no se vuelve ciegamente al lector anterior ni se borran
> datos para forzar una reversión. Cualquier defecto o desviación detiene
> la liberación y se reporta.