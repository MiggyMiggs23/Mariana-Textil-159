# 5. Preparación autorizada y validada; liberación todavía no autorizada

El estado actual es **paquete preparado y validado, no liberado**. La fuente
31804125 con overlays 07cc804a, e0f1c227 y 226509ca está fijada por hashes en
manifest-final.json; el preflight corregido es af48ed59. El arranque real del
candidato corregido pasó healthz, workers, preflight positivo, INSPECTION y
conservación de catálogo/filas/secuencias; candidato y PostgreSQL se detuvieron
y la base de prueba se destruyó.

Las autorizaciones literales están en los archivos autorizacion-*.txt y
aclaracion-entradas.txt. La **única plantilla vigente de fase B es el documento
09**, completamente identificada salvo la hora del domingo 27 de septiembre
de 2026. No está otorgada ni se ejecutó. Google Drive con respaldo/restauración
verificados antes de SQL es obligatorio; primer cierre por el propietario en
Mariana con tickets efectivo/transferencia; sin purga ahora. Se conserva toda
evidencia hasta instrucción expresa del propietario.

## Archivo histórico de formulación — sustituido íntegramente por 09

**Todo lo que sigue es el borrador inicial preservado, no estado vigente ni
formulario que deba rellenarse. Sus pendientes fueron resueltos durante la
preparación; ninguna frase histórica concede autorización operativa.**

**Esto es un borrador; no es autorización otorgada.** No sirve responder
“adelante” dejando pendientes técnicos o campos sin completar. Hay dos fases
para no autorizar un bundle cuyo hash todavía no existe.

## Estado actualizado de decisiones

| Decisión | Estado |
|---|---|
| Fuente completa `31804125…` con arrastre | Aprobada para preparación; Entradas aceptada posteriormente |
| Modo de arranque | INSPECTION con preflight externo completo |
| Fallo de append del logger | No bloquea arranque; hash/preflight sí bloquean |
| Custodia/retención del registro y evidencias | Pendiente del propietario |
| Ventana | Domingo 27 de septiembre de 2026; hora pendiente |
| Compatibilidad frontend Entradas | Sin cambio de API/payload en la revisión; frontend no se instala ahora |
| Respaldo/restauración | Google Drive antes de SQL, procedimiento del 13 de septiembre; no ejecutar hoy |
| Primer cierre real | Propietario en Mariana, tickets de prueba en efectivo y transferencia; no ejecutar hoy |
| Hashes/revisión de bundle, preflight y wrapper finales | Bundle compilado y medido; verificación detenida con 5 fallos; preflight/wrapper finales pendientes |

La última fila no es una elección libre de un hash: debe obtenerse de los bytes
realmente construidos y revisados. Las expectativas de catálogo tampoco se
inventan para llenar el formulario.

## A. Autorización de preparación recibida

La autorización efectiva y literal es `autorizacion-propietario.txt`, con
`aclaracion-entradas.txt`. El siguiente formulario se conserva únicamente como
antecedente del borrador inicial: **no se vuelve a solicitar ni se usa como
autorización operativa**. El estado medido está en `06-resultado-preparacion.md`.

> Autorizo únicamente preparar y verificar fuera de la API activa el candidato
> de liberación E2 CLOSED, con fuente [REVISIÓN COMPLETA ELEGIDA] y alcance
> [REVISIÓN COMPLETA CON ARRASTRE ENUMERADO / CANDIDATO SELECTIVO A PREPARAR].
> La referencia A+C es 31804125a1e752bde128d72e9fd44d23972ffff1; cualquier
> cambio respecto de sus SQL debe presentarse de nuevo, no queda aprobado aquí.
>
> Autorizo compilar en una exportación aislada sin conexión ni credenciales
> de la base API y preparar el preflight y el wrapper/registrador para el modo
> [MODO ELEGIDO], con política de logging [POLÍTICA ELEGIDA].
> Las verificaciones permitidas son [LISTA EXACTA]; si requieren PostgreSQL,
> únicamente una base nueva desechable expresamente identificada, nunca la
> base API ni los clones E1/E10.
>
> No autorizo sustituir el bundle activo, conectar el wrapper al workflow,
> cambiar variables del servicio, parar/reiniciar la API, aplicar SQL en la
> base operativa, publicar ni efectuar operaciones de negocio.
> Captura, evidencia funcional de abono, devolución, retenidos y atribución
> histórica permanecen apagados. No autorizo inicializadores/backfills.
>
> Entregar manifiesto con revisión/árbol, entradas de compilación, hashes
> completos de salidas, SQL, preflight y logger, resultados y plan de recuperación.
> Si aparece una discrepancia fuera del alcance, detenerse y reportarla.

Esta autorización A tampoco se ha otorgado en la solicitud actual.

## B. Autorización final de liberación, solo con manifiesto terminado

Todos los campos deben sustituirse por valores exactos y documentos cerrados:

> Autorización del propietario para la ventana [FECHA, HORA, ZONA, DURACIÓN],
> ejecutada por [OPERADOR], exclusivamente en [IDENTIDAD VERIFICABLE DEL DESTINO,
> SIN CREDENCIALES] y el servicio artifacts/api-server: API Server.
>
> Apruebo el manifiesto [RUTA, REVISIÓN Y SHA-256 DEL MANIFIESTO FINAL], la fuente
> de compilación [COMMIT Y ÁRBOL], el alcance y arrastre [INVENTARIO APROBADO],
> y el bundle [RUTA Y SHA-256]. Apruebo el modo [MODO EXACTO], el preflight
> [RUTA, REVISIÓN, SHA-256 Y CONTRATO B0/B1] y los scripts de arranque/registro
> [REVISIONES Y HASHES], con política ante fallo de registro [POLÍTICA].
>
> Autorizo las lecturas previas, el respaldo y su verificación/restauración
> [PLAN EXACTO, DESTINO AISLADO Y EVIDENCIA], la pausa y reanudación de escritores
> [PLAN EXACTO], y únicamente la instalación A+C del archivo
> sql/01-install-evidence-prepared.sql con SHA-256
> 3360d2b7edea27342cc073a7d6f864690dfb677f73dd3a0d57de46a522120a7c,
> seguida del preflight sql/03-preflight-schema-prepared.sql con SHA-256
> b368c7239f83b088d1fa5c30d1c1d0dd08538842d18a694315bd88b7f1e5980c
> y de las comprobaciones completas del manifiesto.
> Estas rutas son relativas a reports/e2-paquete-liberacion-preparado-20260921/.
>
> El alcance DDL es exactamente las dos tablas A+C con sus constraints/índices,
> dos columnas de procedencia xid8 y funciones/triggers del instalador.
> No autorizo SQL adicional, reparaciones de dependencias, backfills, apertura
> LIMITED, cambios de guardas E1 ni DML financiero como validación.
> El snapshot de corte se guarda en auditoría existente; no autoriza DDL ni
> reconstrucción de cierres históricos.
>
> Si todos los controles anteriores pasan, autorizo instalar los artefactos
> aprobados, conectar scripts/api-start-audit.sh al servicio existente y un
> único arranque de liberación a través del wrapper, con registro desde ese
> mismo intento. No autorizo rebuild al arrancar ni otros reinicios automáticos
> como reparación. Guardas CLOSED y los cinco flags descritos permanecen apagados.
>
> Autorizo las comprobaciones posteriores de solo lectura [LISTA/APARTADOS].
> Para el primer cierre, elijo [NO AUTORIZAR AÚN / AUTORIZAR UN ÚNICO CIERRE REAL
> DE LA SESIÓN ..., SITIO ..., POR ACTOR ..., CON CONTEO REAL APROBADO ... Y
> CRITERIO DE ACEPTACIÓN ...]. No crear operaciones ficticias para prepararlo,
> no repetir un cierre incierto sin verificar si se confirmó y no borrar su
> auditoría/snapshot. Si no autorizo el cierre, ese criterio de aceptación
> quedará pendiente y no podrá declararse verificado.
>
> Antes de reanudar operación y únicamente si no existen nuevas marcas,
> actividad ni evidencia A+C, elijo [NO AUTORIZAR REVERSIÓN AUTOMÁTICA /
> AUTORIZAR EL CAMINO DE REVERSIÓN DESCRITO ...] con
> sql/02-revert-before-capture-only.sql, SHA-256
> 0f5952b874bb9fead4f782b9b169636564d302f00f20d5e4bf135896c9b32b3c,
> tras comprobar identidad, CLOSED y todas sus condiciones.
> No forzar la reversión si se niega. Después de actividad o del primer cierre,
> conservar evidencia y pedir autorización específica; no volver al bundle
> pre-E2 ni restaurar un respaldo sobre operaciones posteriores.
>
> Un fallo de identidad, hash, preflight, compatibilidad, logging según la
> política elegida, o aceptación del corte exige detenerse y reportar.
> No autorizo resolver decisiones nuevas, alterar expectativas para pasar,
> abrir captura/devolución, modificar otros servicios ni publicar.

## Texto original que limita esta preparación

> miguelestza: Solo preparación. No toques la base de la API, no reinicies la API,
> no cambies el bundle y no ejecutes nada.
>
> Prepara el paquete de liberación de E2 para cuando el propietario lo autorice, con:
> 1. Qué entra al nuevo bundle (corte E2 con snapshot, evidencia A+C con captura y devolución apagadas) y desde qué revisión se compila.
> 2. El SQL exacto que se aplicaría a la base de la API, en orden, con su reversión, y qué comprueba el preflight antes y después.
> 3. La activación del registro de arranques (scripts/api-start-audit.sh) en el mismo reinicio.
> 4. Qué se verifica después de arrancar, incluido un primer cierre nuevo con snapshot.
> 5. El texto de autorización que tendría que dar el propietario, con su alcance exacto.
>
> Si algo del paquete depende de una decisión del propietario, anótalo sin resolverlo. Guarda todo en reports/ con la revisión exacta.