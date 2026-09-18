# E1 — validación del código y límite de reanudación

**Actualización posterior:** el ensayo real en el clon ya se ejecutó bajo una nueva autorización: **100/103 PASS y tres brechas de cierre frente a SQL directo**. Véase [resultado-ensayo-clon.md](resultado-ensayo-clon.md). El resto de este documento conserva el estado anterior, al terminar la verificación offline.

## Estado

**Código E1 implementado y comprobaciones permitidas terminadas. E1 NO se declara cerrado ni la API lista para reanudarse. La API permanece pausada.**

El DDL autorizado quedó confirmado y verificado; véase `migracion-aplicada.md`. La comprobación transaccional real de los productores nuevos no se ejecutó: requiere escrituras adicionales, no incluidas en la autorización de las 27 sentencias, ni siquiera dentro del clon.

## Implementación

- Siete productores: venta a crédito, cancelación de venta a crédito, abono ordinario, abono dirigido, reverso de abono, ajuste manual y baja incobrable.
- Adaptados los accesos POS, clientes, autorizaciones dirigidas, notificaciones y cancelación desde Salidas. Esta última es otro acceso al mismo productor, no un octavo productor.
- Origen explícito, cuatro naturalezas exactas, sesión coherente cuando corresponda y errores claros para solicitudes antiguas.
- Identidad compuesta productor + UUID; contenido canónico limitado a campos permitidos, sin credenciales. Autorización actual antes de devolver un reintento; validaciones de estado mutable y efectos posteriores solamente para una operación nueva.
- Contratos OpenAPI, validadores y clientes generados, formularios y evidencia histórica preparados. Compatibilidad con Zod 3 conservada sin quitar validación de enteros ni UUID.
- Históricos sin origen inferido. Atribución separada y append-only, con instante exacto, identidad completa, evidencia, motivo y cadena.
- Captura física de efectivo, cobros retenidos y atribución histórica: **las tres puertas siguen cerradas**. No se activaron ni se ejecutaron operaciones reales.
- No se cambió FIFO, deuda, favor, cálculo del límite ni los candados de producto–ubicación.

## Comprobaciones ejecutadas

| Comprobación | Resultado y alcance |
|---|---|
| Typecheck canónico de todo el workspace | PASS; 0 diagnósticos únicos y 0 fallos de proceso/parser |
| Typecheck frontend posterior a los ajustes de fixtures | PASS; código de salida 0 |
| Manifiesto E1 backend/contratos, cinco archivos explícitos | 59/59 PASS, sin omitidas |
| Manifiesto frontend permitido, 100 archivos explícitos | 361 casos cubiertos mediante pasada global y confirmación enfocada, detalle abajo |
| Pruebas nuevas frente a defectos introducidos | 66/66 casos vistos fallar con AssertionError y pasar al restaurar; ningún caso sin prueba negativa |
| Revisión independiente de integración y permisos | Sin bloqueantes concretos restantes en el código revisado |
| Vista previa | Frontend muestra login; no se inició sesión. HTTP 502 esperado por la API pausada |

### Precisión sobre la suite frontend

No se afirma una única pasada global final con salida 0. La última pasada completa ejecutó **361 casos: 360 pasaron y uno falló**. Ese fallo era del detector de la prueba: confundía el nuevo selector de sitio con una aplicación manual de favor. Se corrigió únicamente el detector, conservando las cifras y el comportamiento financiero, y se ejecutó su archivo enfocado: **2/2 PASS**.

La prueba además insertó temporalmente un control monetario de favor etiquetado en el DOM aislado, demostró que el detector sí lo encuentra, lo retiró y confirmó su ausencia. Los otros 360 casos no quedaron invalidados por esa modificación exclusiva de la prueba. No quedan fallos conocidos sin resolver dentro del manifiesto permitido.

La cobertura combinada es de **420 casos distintos: 361 frontend + 59 backend/contratos**. No equivale a ejecutar toda la batería del repositorio: las suites de integración que crean usuarios, sesiones o registros financieros y las exclusiones PDF/red previamente inventariadas no se ejecutaron.

### Pruebas negativas nuevas

| Grupo | Casos nuevos observados en rojo y verde | Defectos concretos |
|---|---:|---:|
| Contrato puro y adaptadores reales con Drizzle simulado | 31 | 18 |
| Lectura y atribución de evidencia con consultas simuladas | 14 | 14 |
| Productores de clientes y autorizaciones, handlers ejecutados con dependencias interceptadas | 11 | 12 |
| Ayudas frontend y esquemas generados | 10 | 22 |
| **Total** | **66** | **66** |

Los defectos se aplicaron en copias aisladas bajo `/tmp` o en memoria sobre esas copias, nunca en módulos productivos vigilados. Las huellas de los originales se conservaron. Fallos de compilador, loader o infraestructura no se contaron como pruebas negativas.

Los primeros informes conservan los errores encontrados: lanzamiento incompatible con el aislamiento, generación Zod incompatible, mocks incompletos y detector visual demasiado amplio. No se borraron ni se contaron como aprobados. Las correcciones fueron verificadas con el alcance indicado.

## Aislamiento

- Backend: conexiones y sockets bloqueados, incluidos pool y conexión singleton de las pruebas de adaptadores.
- Frontend: fixtures estáticos locales y Chromium, no la aplicación ni su API. Solamente servidores HTTP marcados en `127.0.0.1` con puerto efímero; rutas estáticas limitadas e interceptación de los demás orígenes.
- Comprobaciones del aislamiento: 5432, 8080, sockets Unix y orígenes ajenos rechazados; modo estricto del backend conservado.
- Procesos de prueba sin credenciales operativas heredadas. El valor de conexión simulado no puede conectarse.
- Ninguna creación de usuarios o sesiones de aplicación/caja; ninguna escritura real de datos mediante las pruebas.
- Typecheck separado, con entorno limpio; no se presenta su proceso como una prueba con bloqueo de sockets.

## Evidencia conservada

- `validacion/core/report.json`
- `validacion/evidencia/report.json`
- `validacion/rutas/report.json`
- `validacion/frontend-contratos/result.json`
- `validacion/rutas-evidencia.json`: correspondencia entre rutas temporales originales y copias conservadas.
- `validacion/e1-backend-baseline-loader.log`
- `validacion/e1-frontend-static-fixtures.log`
- `validacion/e1-cash-favor-focused.log`
- `validacion/e1-typecheck-corrected.log`
- `validacion/e1-typecheck-frontend-final.log`
- `frontend-con-api-pausada.jpg`

## Pendiente antes de certificar reanudación

Los mocks no prueban que los siete productores completen transacciones PostgreSQL reales, ni los round-trips JSONB/fecha/numeric, la convivencia de triggers, las esperas de unicidad concurrentes o el rollback conjunto de ledger, aplicaciones, auditoría, inventario y notificaciones.

`propuesta-verificacion-aislada.md` documenta el diseño de una segunda base desechable, sin tocar la operativa, el clon conservado ni Drive. **Es un borrador, no un alcance ejecutable autorizado:** faltan el script fijado, manifiesto de registros elegibles, inventario final de efectos indirectos y límites exactos de filas. No se solicita ni presume autorización de escritura sobre ese borrador. El SQL de migración contiene una comprobación de identidad operativa que no puede trasladarse ciegamente al ensayo.

No se levantó la API ni se importó su arranque para verificarla. No se publicó. El clon original y el respaldo de Drive se conservan hasta cerrar E1.

La suficiencia de la evidencia histórica y el sitio real de recepción de cada histórico siguen siendo decisiones del propietario; no se deducen ni se ejecutan en esta entrega.