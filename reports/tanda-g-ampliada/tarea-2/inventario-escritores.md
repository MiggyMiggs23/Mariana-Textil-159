# Inventario estático de escritores y fronteras

Rutas relativas al repo; líneas del árbol inspeccionado ee1bb64. Alcance: tablas físicas `rollos`, ledger `movimientos`, caché `existencias`; productores operativos y mantenimiento del servidor/db. No incluye escrituras deliberadas de fixtures/suites en producción.

## Semántica y controles DB

`lib/db/src/schema/rollos.ts:50-59`: cantidad_inicial/cantidad_actual numeric(10,3), NOT NULL; no CHECK de signo en definición. FK, enum, NOT NULL y precisión NO impiden -2. Numeric admite NaN: un CHECK >=0 solo NO asegura cantidad física finita. Los constraints reales deben inventariarse en copia mediante pg_constraint/pg_trigger; lo estático no certifica drift de DB viva.

`movimientos.cantidad` es firmado: ventas, transferencias de salida, ajustes negativos y reversos válidos requieren negativos. `saldo_posterior` y `existencias.cantidad_total` son derivados del ledger, NO cantidades físicas individuales. No proponerles prohibición global de negativos. `rollos_count` es conteo disponible.

## Escritores finales: artifacts/api-server/src/lib/inventario.ts

| Líneas | Productor | Mutación/guardas físicas |
|---|---|---|
| 313-321 | refreshExistencias | Upsert suma ledger/conteo disponible; no límite de signo |
| 393 | insertMovimientoWithDependencies | Ledger firmado, canonicalización milésimas; lock por par, no CHECK físico |
| 543-595 | crearRollo | Inicial y actual desde input; costo positivo; helper 517-533 exige entero >0 SOLO PIEZA/BOLSA; METRO/KILO retornan sin validar |
| 709-911 | crearEntrada | Inserta inicial/actual desde cantidades; 823-841 entero discreto, **no positividad universal en servicio**. Comentario delega validación al caller; enteros negativos discretos también son riesgo directo |
| 1164-1230 | capturarCostosEntrada | Cambia costos, no cantidades |
| 1323-1405 | activarRollo | PROGRAMADO→DISPONIBLE; escribe inicial/actual cantidadReal; mismo helper parcial 1380. METRO/KILO negativos alcanzan persistencia |
| 1480-1524 | transferirRolloInmediato | Ubicación/estado/piso; conserva cantidad; ledger -origen/+destino |
| 1555-1610 | moverRollo | Ubicación/estado EN_TRANSITO; conserva cantidad |
| 1678-1734 | recibirTransferencia | Ubicación/estado disponible; conserva cantidad |
| 1794-1826 | salidaMostrador | Actual=0, estado MOSTRADOR |
| 1877-1917 | venderRollo | VENDIDO; actual=0 opcional, en otro caso conserva actual |
| 1963-2013 | consumirBolsasFifo | Consumo entero positivo, suficiencia y saldo restante; decrementa cantidad |
| 2050-2201 | consumirRollosMetreadoSeleccionados | Fuentes positivas, total coherente, estado/producto y suficiencia 2185; resta por fuente |
| 2245-2339 | ajustarRollo | Cantidad explícita <0 rechazada 2314-2319; baja null escribe cero; discreto entero/no negativo |
| 2384-2487 | crearSalidaExtraordinaria | Exige cantidad previa >0 (2477), actual=0 BAJA |
| 2556-2635 | reactivarFaltanteAuditoria | Restaura cantidadAnterior de evidencia; requiere contexto/admin/causa; guarda de signo del valor histórico requiere verificación dinámica específica |
| 2680-2882 | revertirMovimiento | Estricto restaura evidencia; legado calcula suma o conserva; cubrir ambos modos por separado, no inferir no negatividad de los tests estrictos |
| 3093-3148 | recalcular/reconstruirCacheExistencias | Upsert SQL suma movimientos y conteos; no cantidad física |
| 3233-3253 | revisarAjuste | Metadatos revisión ledger; no cambio de cantidad |

## Otros escritores / mantenimiento

- `artifacts/api-server/src/routes/inventario.ts:1688`: piso, sin cantidad.
- `artifacts/api-server/src/lib/auditoria-inventario.ts:614`: piso, sin cantidad; :523 llama ajustarRollo.
- `artifacts/api-server/src/lib/purga-catalogos.ts:476`: elimina caché de catálogo autorizado, no ledger/físico.
- `lib/db/src/lib/estado-rollo-schema.ts:43,62`: inicializador migra estado ABIERTO y fuerza actual=0 MOSTRADOR. No protege las demás escrituras.
- `lib/db/src/lib/document-folios-schema.ts:63`: actualiza referencia documental del ledger, no cantidades.
- DDL de pisos/costos/salidas añade columnas/relaciones, no impone signo físico.

## Callers operativos y frontera API

- inventario route :908 crearEntrada; :1358 activar; :1424 vender; :1482 ajustar; :701/:1556 reversión.
- pos.ts :1237 vender, :1259 FIFO bolsas, :1322 consumo metreado, :1527 reversión.
- salidas.ts :241 vender; :1848 reversión por cancelación de salida.
- auditorias-inventario route :366 reactivar faltante; auditoria-inventario lib :523 ajustar y transferencias mediante helpers.
- Entradas API inventario.ts :810-836 exige cantidades parseFloat(c)>0; distinta de servicio directo. Contrato numérico no debe inferirse de permisos/autorización.
- Activación API :1329-1365 exige sesión/permiso/alcance de ubicación; `lib/api-zod/src/generated/api.ts:9074-9078` acepta cantidadReal como string sin mínimo. No es guarda de signo.
- Ajuste servicio sí veta físico negativo, pero ledger AJUSTE_NEGATIVO válido tiene signo negativo.

## Cobertura y límites

El runner numérico preparado ejecuta productores creación/entrada/activación/ajuste y API activación para dos sitios/cuatro unidades, antes y después del CHECK. Los demás escritores anteriores requieren escenarios de cadena (transferencias, FIFO, POS, cancelaciones/reversos, auditoría, mantenimientos) y se reportan **sin ejecución en esta fase**, no como aprobados. Es exhaustividad del inventario por búsqueda estática de tablas/SQL, no prueba formal ni afirmación de imposibilidad por tests. Revisar alias/raw SQL y fuentes congeladas al recibir setup.

### Estados imposibles y dos sitios

`rollos.id` PK + `serie` UNIQUE y una única `ubicacion_id` NOT NULL/FK impiden que **una misma fila** tenga dos ubicaciones simultáneas. No impiden dos series distintas para el mismo objeto físico ni doble saldo visible por ledger/cache inconsistente. El enum limita nombres, no compatibilidad cantidad/estado. MOSTRADOR cero tiene productor e inicializador; VENDIDO con actual conservada es semántica deliberada, no clasificar automáticamente como corrupción.

`lockInventoryPairs` (:77) ordena candados por producto×sitio; transferencias escriben salida y entrada bajo transacción, manteniendo una fila física. Esto reduce carreras, no sustituye probar doble traslado, traslado vs venta, recepción repetida, FIFO vs venta, reversión vs sucesor y reconstrucción concurrente. Esos escenarios quedan pendientes explícitos, incluidos rollo/serie únicos, estado final, suma de ledger por ambos sitios, caché y conteo físico antes/después. El barrido numérico en dos sitios **no equivale** a una carrera entre sitios y no debe presentarse así. El CHECK propuesto solo cierra cantidad_actual negativa, no todas las combinaciones imposibles de estado ni consistencia entre tablas.

## Propuesta DB — decisiones, no migración

DECISIÓN PROPUESTA PRINCIPAL: CHECK (cantidad_actual >= 0) sobre rollos; el runner lo aplica únicamente a copia desechable. Para visibilidad desde API se instala temporalmente (committed) en copia, ejecuta fase check y elimina SOLO su constraint nombrado antes de baseline. Las pruebas directas de productores terminan ROLLBACK; fixtures y cambios API quedan conservados en copia para MAIN.

PROPUESTAS ADICIONALES PENDIENTES: cantidad_inicial >=0; excluir NaN de ambas cantidades; integridad discreta dependiente de unidad; conteo caché no negativo. No aplicadas. No imponer actual<=inicial: ajuste al alza puede ser legítimo. No imponer VENDIDO⇒actual=0 sin resolver semántica histórica.

Antes de adopción real: consultar filas negativas/no finitas con IDs, sitio, estado y evidencia; no truncar a cero ni reescribir ledger automáticamente. Decidir corrección trazable por fila con dueño de datos. ADD CHECK normal escanea existentes y falla ante corruptos; NOT VALID evita escaneo inicial pero **sí controla nuevas filas/updates**, incluso un update de metadatos sobre fila corrupta puede fallar. No sanea ni certifica antiguas. VALIDATE CONSTRAINT verifica todas y falla si siguen corruptas. No se ejecuta NOT VALID/VALIDATE contra DB real ni se añade migración.