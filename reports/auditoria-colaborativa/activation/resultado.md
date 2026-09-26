# Activación: auditoría colaborativa, unión explícita y pisos

**Fecha:** 26/09/2026. **Estado:** API y frontend finales activados por MAIN. Este informe documenta la evidencia existente; su elaboración no ejecutó servicios, builds, escrituras de datos ni cambios de runtime.

### Corrección posterior de texto: frontend mensaje activado por MAIN

MAIN activó **solo el nuevo frontend**, `artifacts/mariana-textil/dist-auditoria-colaborativa-mensaje-20260925`, con `index.html` SHA256 servido `be762ee00aaeb78427d040d9f6cc6be95b8c05d7ad99e6af2c1cd76b7268a643`. Validó TOML, reinició web una vez para esta revisión y confirmó las 11 guardas SHA. La API final permanece intacta y **no se reinició** para este cambio de texto. El frontend final anterior queda como artefacto histórico probado, no como frontend actualmente servido.

La única diferencia de fuente respecto del staging final es una línea de la descripción del toast: muestra serie, **Registrado** y estado, en vez de presentar la clasificación de la respuesta de escaneo como conclusión del conteo. El detalle ya mostraba correctamente piso esperado/real y mala ubicación; no cambian cálculos, clasificación del detalle, permisos ni escaneos. La API no se reconstruyó y conserva SHA256 `e62a79333d0ee1433c114656af980e33ff420b728688a121ee586efdfab1b30d`.

Evidencia nueva: `../mensaje/provenance.json`, `../mensaje/audit-page.diff`, `../mensaje/candidate.json` y guarda `../mensaje/frontend.sha256` (11 archivos). Se verificaron la diferencia exacta de una línea, preservación del resto de fuentes, typecheck aislado, build de producción y hashes; API y frontend previo permanecen intactos. MAIN/UI reportaron **17 pruebas montadas aprobadas** para la corrección. No se reinició ningún servicio durante la preparación; el reinicio web de activación posterior fue ejecutado por MAIN. La procedencia conserva su estado histórico de candidato preparado y este informe documenta su activación posterior.

Las **15 pruebas E2E** y **11 capturas** conservadas siguen documentando las funciones del candidato final anterior; no se afirma haber repetido E2E con este nuevo texto. En particular, el toast **CUADRO** visible en la galería es histórico y **precede a esta corrección neutral**: no debe presentarse como captura del nuevo mensaje ni como resultado de la clasificación detallada.

## Artefactos liberados y procedencia

| Artefacto | Directorio | SHA256 de entrada |
| --- | --- | --- |
| API | `artifacts/api-server/dist-auditoria-colaborativa-final-20260925` | `e62a79333d0ee1433c114656af980e33ff420b728688a121ee586efdfab1b30d` (`index.mjs`) |
| Frontend activo | `artifacts/mariana-textil/dist-auditoria-colaborativa-mensaje-20260925` | `be762ee00aaeb78427d040d9f6cc6be95b8c05d7ad99e6af2c1cd76b7268a643` (`index.html`) |
| Frontend anterior probado en E2E | `artifacts/mariana-textil/dist-auditoria-colaborativa-final-20260925` | `7939daf161141b6f0eb5774307930f08f6157dc9811bc7f117163266a0949f70` (`index.html`) |

La base fue la versión activa `dist-directorios-sitios-20260925-sin-rfc`: fuentes API retenidas en sourcemap y frontend retenido en staging. Se congelaron bases, hashes y diferencias antes de componer candidatos. La cadena conservada es noRFC → colaboración → unión explícita → pisos → corrección final de permisos de cierre. Los candidatos previos no se sobrescribieron.

Se preservan directorios de Clientes y Proveedores, períodos/conteos, historiales, selectores de crédito según sitio, las simplificaciones aprobadas 1, 2, 6, 7 y 8 y las demás funciones de la línea activa. El RFC nuevo de proveedores continúa excluido y el RFC preexistente de clientes permanece. No se construyó HEAD completo. Los archivos generados recibieron únicamente segmentos de auditoría, no reemplazos amplios de contratos ajenos.

La última revisión sobre el candidato de pisos cambia solamente el router de auditorías y su página: cerrar exige editar y autorizar, y el control visible respeta esa combinación. Se conservaron los contratos runtime generados de pisos; comentarios de documentación posteriores no requieren reconstruir contratos ajenos.

Evidencia:

- `../frozen/manifest.json`, `../floor-baseline/manifest.json`: bases congeladas.
- `../provenance.json`, `../unirse/provenance.json`, `../pisos/provenance.json`, `../final/provenance.json`: composición y preservación.
- `../final/overlays/`, `../final/diff/`: cambios finales exactos.
- Guardas **activas**: `../final/api.sha256` y `../mensaje/frontend.sha256`; rutas relativas a la raíz del workspace. `../final/frontend.sha256` y `../final/all.sha256` conservan la identidad histórica de la primera activación, antes del toast neutral.
- `../final/candidate.json` y `../browser-live/candidate.json`: identidad del candidato final probado en E2E. `../mensaje/candidate.json`: combinación actualmente activa de API final y frontend mensaje.

## Comportamiento incorporado

- Hasta **cinco usuarios distintos activos por auditoría**, no cinco pestañas. Consultar la auditoría no consume un lugar: la interfaz exige **Unirse**. La renovación ocurre cada 20 segundos y la participación vence a los 90 segundos; el sexto activo recibe HTTP 409 y queda sin escaneo. Un usuario aún activo puede renovar a cupo lleno.
- Participantes e historial, conteo compartido y autor de cada rollo permanecen visibles. El primer escaneo conserva autor, hora y piso; un duplicado no agrega otro registro ni sustituye su atribución. La admisión y el escaneo se serializan con el candado de cabecera existente.
- `GET /api/inventario/auditorias/:id/pisos` devuelve pisos activos del sitio auditado, sujeto a sesión, permiso de auditoría y alcance del sitio. No exige permisos administrativos de ubicaciones.
- Computadora usa el **primer piso activo del orden configurado actual `nombre ASC`** devuelto por el servidor. No equivale necesariamente a planta baja, piso número uno ni un orden físico: no se deduce de palabras como “PB”. Cambios de configuración pueden cambiar cuál ocupa esa primera posición.
- Móvil permite elegir piso configurado y confirmar un cambio antes de continuar; la API admite cualquier piso activo válido del sitio. La estación bloquea captura mientras falta selección válida, carga/falla el catálogo o no existen pisos activos. El servidor valida el piso y rechaza configuración faltante o selección inválida.
- Resultados de mala ubicación muestran **piso esperado y piso real**, junto al autor original. Escanear, detectar diferencia y cerrar conteo no aplican automáticamente una confirmación de existencias ni trasladan el rollo.
- **Cerrar exige editar + autorizar**, además de sesión, rol y sitio. Ser creador o participante no sustituye autorizar. Cancelar conserva editar y las guardas existentes; confirmar conserva autorizar + ADMIN.

### Límite de clasificación del dispositivo

La clasificación móvil/computadora se deriva de User-Agent (`Android|iPhone|iPad|iPod|Mobile|Tablet`), no del ancho de pantalla. Es una **heurística ergonómica falsificable**, no autenticación de hardware, inventario de equipos ni frontera de autorización. No se garantiza detectar físicamente un teléfono o una computadora. Los permisos y el alcance de sitio siguen siendo obligatorios independientemente de esa clasificación.

## Validaciones del candidato

Los builds aislados aprobaron typecheck de dependencias/frontend, producción Vite, comprobación sintáctica de todos los módulos API y verificación de hashes. La comparación de fuentes verifica preservación de módulos y exclusión de cambios ajenos. Vite emitió advertencias no fatales de ubicación de sourcemap y tamaño de bundle; no se presentan como errores resueltos.

El resultado final `../browser-live/browser-result.json` identifica exactamente los hashes de la primera activación (API aún vigente; frontend anterior al toast neutral) y contiene **15 comprobaciones aprobadas** con seis contextos autenticados aislados:

1. Un sitio vacío ofrece iniciar al creador autorizado.
2. Seis contextos consultan sin consumir cupo.
3. Tres contextos táctiles con User-Agent móvil se unen explícitamente y eligen pisos configurados distintos.
4. Escaneos concurrentes reales propagan el conteo compartido.
5. Mala ubicación conserva piso esperado, real y autor, sin autoaplicación.
6. Duplicado concurrente crea una sola fila y conserva autor/piso.
7. Las tres sesiones ven faltantes y autores compartidos.
8. Escritorio fija el primer piso configurado y no ofrece cambiarlo.
9. Cuarto/quinto admitidos; sexto recibe 409 y escáner bloqueado.
10. Refresco/reingreso del mismo usuario a cupo lleno y renovaciones.
11. Usuario con editar sin autorizar recibe **403 al cerrar** y no ve el control de cierre.
12. Usuario BODEGA fuera de sitio recibe 403 al unirse y escanear.
13. Sitio sin pisos activos bloquea captura y el servidor rechaza.
14. ADMIN real de la base desechable cierra por API sin confirmar existencias.
15. La fila renderizada muestra ambos pisos y autor; evidencia visual inspeccionada.

Hay **11 capturas** en `../browser-live/screenshots/`, con hashes en `screenshot-manifest.json` y galería `gallery.html`. Corresponden al sistema real contra entorno aislado, no a una maqueta; los contextos y User-Agent no son seis dispositivos físicos.

La selección inicial móvil sí se recorrió en E2E. La **confirmación de un cambio posterior de piso móvil** está cubierta por pruebas de componentes montados, no por una comprobación E2E específica de esa transición. MAIN recibió previamente el resultado de 26 pruebas UI y cuatro PG; el resultado final autoritativo del navegador es el archivo de 15 comprobaciones citado arriba.

El archivo histórico `../browser-live/closure-check.json` registra un cierre permitido con editar en un candidato anterior: fue el defecto detectado, **no evidencia favorable del candidato final**. La corrección conserva esa evidencia y se prueba en la comprobación final de cierre 403; `restart-verification.json` identifica el cambio de candidato sin reseed/reset. La base de prueba conserva la auditoría cerrada durante la detección del defecto; no se reescribió su historia para ocultarlo.

`../browser-live/final-database-proof.json` documenta autor/piso capturados, ubicación de inventario conservada y ausencia de confirmación de existencias en la base aislada. No constituye una captura de producción.

## Activación inicial y revisión de texto ejecutadas por MAIN

Según el handoff de ejecución de MAIN:

- Validó los TOML administrados y las guardas SHA.
- Reinició **una vez cada workflow administrado** para servir el candidato final.
- Observó API PID **11968**, `API_INSPECTION_BOOT=1`, sin ejecución de inicializadores.
- Verificó salud HTTP 200 y frontend HTTP 200 con hash inicial `7939daf161141b6f0eb5774307930f08f6157dc9811bc7f117163266a0949f70`.
- Posteriormente activó el frontend mensaje con TOML validado, un reinicio web adicional, 11 guardas aprobadas y hash servido `be762ee00aaeb78427d040d9f6cc6be95b8c05d7ad99e6af2c1cd76b7268a643`; no reconstruyó ni reinició API.
- Los comandos administrados actuales verifican `final/api.sha256` y `mensaje/frontend.sha256` antes de iniciar y sirven API final + frontend mensaje.

Estos datos de runtime son los reportados por MAIN; este trabajo documental no repitió reinicios ni inspección de procesos. La prueba funcional autenticada corresponde al candidato aislado previo al toast neutral. La primera activación incluyó arranque, salud, identidad del frontend y capturas READ ONLY; la revisión exclusivamente textual comprobó guardas e identidad servida. No se afirma un segundo par de capturas de base para esta revisión ni haber repetido toda la prueba funcional contra la base activa.

## Base activa: comparación READ ONLY y excepción explícita

MAIN capturó la base correspondiente al proceso efectivo en transacciones READ ONLY:

| Evidencia | Momento UTC | Tablas |
| --- | --- | --- |
| `before.json` | 2026-09-26 01:43:09.175 | 108 |
| `after.json` | 2026-09-26 01:43:44.518 | 108 |

Resultados observados:

- `sameDatabase: true`; `sameSchema: true`.
- `changedCounts: []`: todos los conteos iguales.
- `changedHashes: ["sesiones"]`: **107 tablas conservaron su hash**, incluidas las operativas y de auditoría; **sesiones no conservó su hash**.
- `sesiones`: una fila antes y una después. Su hash cambió de `1ecda14bca6dedd7374f1e9f1c01a54dabf3e4c4592ecd86e1090f47bec2f3af` a `0c918e465ebdae27c845521c9b3a4e39c539fe388c0af4f98ec4b7d719605d79`.
- El comparador estricto dejó **`passed: false`** en `after.json`, coherente con la diferencia de contenido. No se altera ni se reinterpreta como igualdad total.

La causa exacta de la diferencia de sesión **no fue determinada**. MAIN observó una solicitud de usuario activo, pero eso no demuestra qué causó el cambio ni permite atribuirlo automáticamente al reinicio. No hubo aumento neto de filas; las capturas, por sí solas, no demuestran ausencia de toda operación transitoria entre ambos momentos.

Por tanto, **no se afirma que las 108 tablas quedaron idénticas en contenido**, ni “cero escrituras” como garantía global. Sí se documentan igualdad de base/esquema, conteos sin cambios y los 107 hashes operativos restantes conservados. No se ejecutó DDL, migración ni se crearon fixtures sobre la base activa para esta liberación. La reutilización de estructuras existentes no necesitó tablas ni columnas nuevas.

## Limpieza del entorno de prueba

MAIN detuvo el launcher privado y eliminó su propia rama de prueba en Neon: la eliminación respondió `isError: false`. Después realizó una lectura `describeProject`, también `isError: false`, en la que la rama **ya no figura**. La limpieza queda verificada por esa lectura posterior, no solo inferida de la solicitud de eliminación. Los archivos de evidencia se conservan; no se deben reutilizar los scripts de fixtures sobre la base activa.