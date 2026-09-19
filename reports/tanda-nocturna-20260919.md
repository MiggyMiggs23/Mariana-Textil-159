# Tanda nocturna — 2026-09-19

## Resultado general

**Tanda cerrada con entregas parciales y bloqueos explícitos; no liberada.**
Se ejecutó después de guardar el informe PostgreSQL de A+C. Ese intento previo
falló al instalar el candidato exacto y su base desechable fue destruida.
No se repitió ni corrigió A+C durante esta tanda.

Instrucción recibida: adjunto del propietario, conservado byte por byte en
`tanda-nocturna-20260919/instruccion-propietario.txt`.

Base de esta tanda: `52fba053c44241263abc78c8085e5a8d0a6637c9`.
**Revisión final de código verificada: `7643992863b4956757d18a32b92a3c0f5fe9f6ad`.**
Los archivos de cierre posteriores son documentación/evidencia, no cambios de código de la aplicación.

| Tarea | Resultado | Commit propio / revisión exacta |
|---|---|---|
| 1 — E8 | Completa en fuente; backend servido sin modificar | `173b7cf1373c7fb568209453721dbf510c5b1d38` |
| 2 — E6 | Pantallas e identidad canónica completas; exportaciones/documentos detenidos | `9c337df6b750223bc8a4863dc8f847c733f3f161` |
| 3 — Cinco fallos | Tres casos corregidos; dos protegidos permanecen en rojo | `266392ec4a8b728640dcd4990e1a7dbc565cd860` |
| 4 — Remate/precios/borrado | Preparación parcial e inactiva; remate no completo | `769c5c7226ae984f8b2c6ebe01a54c652a8ea5c7` |
| 5 — 28 suites | Clasificación completa; tres extracciones parciales sin DB; integraciones bloqueadas | `7643992863b4956757d18a32b92a3c0f5fe9f6ad` |

T4 se comprometió antes de T5 porque las nuevas pruebas de T5 leen una dependencia preparada en T4.
Cada tarea tiene su propio commit de implementación. Los complementos de evidencia
de T2/T5 y la comparación final se guardan en el cierre, sin mezclar cambios de aplicación.

## 1. E8 — Inventario solo productos activos

La selección común de `/inventario/existencias/agrupadas` exige `p.activo = true`.
Cubre existencia, `includeSinExistencia`, búsqueda y ubicación. No se extendió a
kardex, series, auditorías, reconstrucción, conciliación ni históricos.
No cambió la respuesta ni necesitó una API nueva para el frontend.

**Pruebas:** handler real transpilado con dependencias en memoria, más la suite
existente de semántica de inventario: **7/7 PASS, exit 0**.
Quitar el filtro en la copia en memoria produjo **exit 1** por devolver el
producto inactivo; la restauración volvió a verde.
No se ejecutó la consulta contra PostgreSQL ni se verificó el endpoint servido.

Evidencia: [tarea-1/informe.md](tanda-nocturna-20260919/tarea-1/informe.md).

## 2. E6 — Contado cobrado y Cobranza del periodo

Cuentas Destino y la banda de Tiempo real distinguen ambos nombres.
Se conservaron claves técnicas, importes, filtros, enlaces y fuentes.
`replit.md` ahora usa **Ventas = Contado + Ventas a crédito**;
Contado cobrado es la etiqueta de Contado. Se retiraron las reglas de
nomenclatura sustituidas, sin cambiar la atribución financiera por sitio.

**Pruebas:** ambos componentes reales montados con React/JSDOM, comparados
contra snapshots previos y tres fixtures: **2/2 PASS**.
La comparación alcanza cada componente numérico, total, variación visible y
argumentos de enlaces/filtros, con precisión de centavos.
Regresiones enfocadas existentes: **20/20 PASS**.
Nueve mutantes de etiquetas, accesibilidad e importes fueron rechazados;
el complemento `process-red/` acredita **nueve procesos exit 1 por aserción
primaria**, seguidos de restauración **exit 0, 2/2 PASS**.
Los primeros negativos capturados con `assert.throws` dentro de un proceso verde
se distinguen expresamente de esta prueba posterior de proceso rojo.

**Detenido:** XLSX/PDF están en `routes/admin-analytics.ts`, que comparte el corte
E2 y se conservó completo. Sus documentos no se declaran renombrados ni se
simuló un exportador alternativo. No se alteró su cálculo.

**R6:** «Cobros de periodos anteriores» no aparece en la fuente actual buscada;
sí en antecedentes documentales contradictorios. La fuente de Cuentas Destino
usa «Cobros por abonos y saldos a favor» / «Neto del periodo, incluidos reversos».
No se inspeccionó la pantalla autenticada, un PDF guardado ni el bundle para
resolver esa discrepancia histórica/visual.

Evidencia: [tarea-2/resultado.md](tanda-nocturna-20260919/tarea-2/resultado.md).

## 3. Cinco casos conocidos en rojo

El inventario correcto es **cinco casos en tres archivos**, no cinco archivos.
La reproducción aislada de `80eaa93d` y de las fuentes previas dio en ambos
**19 pruebas: 14 PASS y los mismos cinco fallos**.

- Dos casos de `clientes-notas-credito.contract.test.ts` comprueban ahora
  estados derivados y aplicaciones en ambas direcciones ejecutando el router
  real con colaboradores en memoria, no buscando una forma textual de código.
- `clientes-pagos.contract.test.ts` distingue esquema y captura. El enum
  **sí acepta EFECTIVO**. La fixture antigua carecía de `naturaleza`,
  `operacionClave` y `sitioOrigenId`; ahora comprueba esos errores exactos y
  acepta el DTO completo como control positivo. La guarda real de captura
  rechaza correctamente el ingreso físico en efectivo con **403**; el control
  por transferencia pasa. No se cambió código productivo ni se abrió la guarda.
- Los dos casos de `pos-caja-final.contract.test.ts` quedaron **detenidos**:
  el archivo contiene pruebas protegidas de devolución/corte. Se conservó
  entero, no solo sus bloques protegidos.

**Pruebas finales del alcance editable: 6/6 PASS.** Con el tercer archivo intacto:
**19 pruebas, 17 PASS y 2 FAIL conocidos/protegidos**.
Cuatro procesos con defectos aislados de estado, identidad de aplicación,
evidencia E1 y guarda de efectivo terminaron **exit 1** por la aserción prevista;
cada restauración dio **6/6 PASS, exit 0**.
Las fuentes protegidas solo se mutaron en memoria del proceso de prueba.

Evidencia: [tarea-3/resultado.md](tanda-nocturna-20260919/tarea-3/resultado.md).

## 4. Remate, precio mínimo y borrado — INACTIVOS

Preparado con puertas API/UI cerradas:

- Permiso configurable «Marcar remate», solo ADMIN por defecto, handler,
  adaptador y componente por rollo/motivo **sin montar**.
- Bloqueo de precio inferior al costo en el helper real usado por las
  mutaciones individual/masiva de Precios, y presentación cerrada.
- Excepción acotada para borrar producto sin movimientos con su
  `precio_historial`, manteniendo existencia cero, referencias, credenciales
  ADMIN, auditoría, transacción y reserva del SKU.
- SQL separado de preparación/reversión, **sin ejecutar ni registrar al arranque**.
  No se añadieron columnas globales Drizzle que obliguen al código cerrado a
  consultar un esquema no aplicado.

**Detenido:** contrato/ruta/montaje canónico de remate y conexión con venta,
marca de venta y pérdida en utilidad requieren archivos protegidos.
Por tanto **remate no está completo ni listo para liberar**.
Costo desconocido/alta sin costo y edición/retiro de marca no se resolvieron
inventando reglas. Las otras vías de edición/importación de precio no quedan
cubiertas por este piso. Se documentó, sin cambiarla, la discrepancia previa
entre la regla ADMIN de Precios y su middleware por matriz.

**Pruebas:** cuatro pruebas semánticas de cuerpos reales con mocks, cuatro
procesos mutados **exit 1** y restauración **4/4 PASS**.
Matriz existente: **2/2 PASS**. Typechecks enfocados API/frontend: exit 0.
El componente se ejecutó con React simulado; no es montaje React/JSDOM ni
prueba de navegador. El rollback probado es del store simulado, no PostgreSQL.
No se acreditan router HTTP montado, batch completo, concurrencia o venta remate.

Una revisión independiente no encontró bloqueo para conservar esta preparación
**parcial y cerrada**; no la aprobó para activación.

Evidencia y SQL: [tarea-4/resultado.md](tanda-nocturna-20260919/tarea-4/resultado.md).

## 5. Las 28 suites que crean usuarios

Se identificaron **exactamente 28** por el informe de población y sus
inserciones reales, sin sustituirlas por el inventario de Prompt S.
La clasificación individual incluye requerimientos de aislamiento y archivos
protegidos: [clasificacion.md](tanda-nocturna-20260919/tarea-5/clasificacion.md).

- **Tres a-parcial:** obligaciones separables de permisos, redacción TERMINAL
  de productos-cache y confidencialidad SUPERVISOR de role-access-matrix.
  Se extrajeron a tres pruebas sin DB, usuarios persistidos ni sesiones.
- **Veinticinco b**, más el **residual b de las tres anteriores**:
  necesitan base desechable y el contexto de esquema/actores/HTTP documentado.
  No se creó esa base ni se ejecutó ninguna de las 28 integraciones.

Las **28 suites originales permanecen intactas**; no se retiraron sus
aserciones para obtener verde.

**Pruebas:** tres extracciones **3/3 PASS**; tres mutantes aislados generaron
aserción y **exit 1**, con cada restauración **3/3 PASS**.
Al vincular al commit final se detectó un cambio concurrente en `permisos.ts`
(candado local de matriz). Se reconfirmó el archivo explícito sin DB:
**3/3 PASS en la revisión final**, sin repetir el typecheck raíz.
La reconfirmación enfocada del mutante de permisos y su restauración se
conserva en `final-task5-binding/`; los otros dos mutantes conservan sus
entradas idénticas a la revisión final. No se atribuye silenciosamente
la evidencia inicial al árbol posterior.

Evidencia: [tarea-5/resultado.md](tanda-nocturna-20260919/tarea-5/resultado.md).

## Typecheck raíz y comparación final

| Medida | Baseline `80eaa93d4300e86d9be54492e634f88f0c0abc90` | Final `7643992863b4956757d18a32b92a3c0f5fe9f6ad` |
|---|---:|---:|
| `pnpm run typecheck` raíz | exit 0 | exit 0 |
| Bibliotecas completadas | 6 PASS | 6 PASS |
| Agregado de bibliotecas | PASS | PASS |
| Paquetes de artefactos/scripts | 4 PASS | 4 PASS |
| Diagnósticos únicos / repetidos | 0 / 0 | 0 / 0 |
| Fallos de parser/proceso | 0 | 0 |

Comparación equivalente, todos los deltas cero. Cada ejecución usó un archivo
Git aislado, 12 paquetes internos y 150 enlaces, sin enlaces internos que
escaparan a fuentes del workspace. La salida del compilador quedó en la copia
aislada, no en el bundle servido. Integridad posterior: **3,593 blobs de la
revisión final comparados, cero discrepancias**.

Evidencia: `tanda-nocturna-20260919/typecheck/root-comparison.json`,
`final-result.txt`, `terminal-state.txt`, logs y manifiesto.
No se suman las distintas suites como si fueran cobertura única.

## Restricciones conservadas y pendientes

- En esta tanda **no se accedió a la base de la API ni se ejecutó SQL contra
  ninguna base**. No hubo login/E2E, creación de usuarios/sesiones ni
  capturas de la app que pudieran consultar su API.
- API conservada: PID **176**, inicio **2026-09-19 02:34:33**, bundle SHA-256
  `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
  Preflight de runtime intacto. No hubo reinicio ni cambio de workflows.
- La comprobación versionada enumeró **768 archivos protegidos** y obtuvo
  **cero cambios**, incluidos A+C, guardas/reportes E1/E2 y los archivos
  compartidos detenidos. Resultado: `control-integridad.json`.
- La UI modificada solo renombra datos que la API actual ya soporta.
  Las funciones que necesitan API/esquema nuevos siguen ocultas/inactivas.
- No hubo instalación de dependencias ni modificación de secretos.
- La apertura de captura/devolución sigue sin autorizarse. Tampoco se
  ejecutó purga, migración, venta remate ni cambio de permisos en una base.

Para continuar hace falta resolver el alcance de edición de los archivos
protegidos y las decisiones de negocio señaladas. Una validación futura con
base desechable requiere su propia autorización. Ningún pendiente se
considera aprobado por este informe.