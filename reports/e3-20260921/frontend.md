# E3 frontend — preparado y apagado, no liberado

Base exacta: `55ac9c70181a01e6b42c56a8beb334417f6512f0`.
Revisión integrada pendiente de commit del agente principal. Las fuentes de
frontend quedan identificadas en `frontend-source.sha256`; no se atribuye un
commit inexistente a este árbol de trabajo.

Este informe sustituye la versión preliminar del diseñador. Se retiraron sus
seis archivos de pruebas nuevos: incluían un test trivial y un supuesto montaje
de Caja que no montaba la captura real. No se contabilizan como evidencia.

## Corregido y terminado en fuente

- E3 sigue `false` en fuente. La ruta del recibo no se monta mientras está
  cerrado; el componente también comprueba cierre/ADMIN y deshabilita la consulta.
- Catálogo central `ACTIVE_MODULES`: con E3 apagado conserva exactamente los
  **32 módulos previos y su orden**, tanto en la matriz de roles como en los
  overrides de usuario. `Modules` conserva identificadores tipados para las
  capacidades preparadas, pero no se enumera directamente en editores.
  La búsqueda de `Object.values/entries/keys(Modules)` solo deja la construcción
  filtrada del catálogo central. El editor de usuarios usa el identificador
  `Modules.USUARIOS`; no mantiene otro listado de módulos. La fixture existente
  de navegación también enumera el catálogo activo.
- Entrada desde Cobros/Caja, sin pregunta de naturaleza ni selección de dirigido.
  Cliente y sesión se obtienen del contexto mínimo E3, no de catálogos financieros
  generales ni del endpoint amplio de sesiones. Se exige sitio con sesión abierta
  única; los casos ambiguos no permiten confirmar.
- El formulario real usa tipos generados y cuentas enumeradas. Se corrigió un
  error real de contrato en el hook de confirmación: antes enviaba `data.data`.
  La entrada actual coincide con el contrato del servidor.
- Vista previa ordinaria FIFO, anticipo y remanente **no se describen como dinero
  dirigido pendiente de autorización**. El favor del abono ordinario se registra
  al confirmar. El recibo sin aplicaciones muestra el favor congelado, no un
  estado retenido inventado.
- Confirmación con intención y sesión congeladas desde su preview. Una respuesta
  incierta no permite volver/abandonar y volver a cobrar; el reintento conserva
  UUID. Se conserva la intención pendiente en almacenamiento de sesión, separada
  por usuario y cliente, para recuperarla tras remontar la vista/recargar la
  pestaña. Si no puede conservarse, no se envía la confirmación. No se afirma que
  esto cubra borrar deliberadamente almacenamiento o cambiar a otra computadora.
- Recaptura solo desde cliente, permiso de matriz `clientes_recapturas`, motivo
  obligatorio (no solo espacios), fecha original explícita en hora de Ciudad de
  México y ninguna sesión de Caja. Confirmación y recuperación conservan la misma
  intención. La constancia dice SIN DINERO NUEVO.
- Cuando E3 esté habilitado, el diálogo legacy desde cliente explica que el dinero
  nuevo va por Caja y lo histórico por Recaptura; no envía a los endpoints legacy
  que el servidor cerrará. Con E3 apagado conserva el flujo anterior.
- Confirmar desde Caja muestra folio opaco del servidor; no imprime ni ofrece
  botón de impresión al cajero. ADMIN tiene vínculos desde abono, estado de cuenta
  y corte. Se corrigió el estado de cuenta, que antes cargaba recibos sin mostrar
  ningún enlace.
- Recibo con nombres congelados de cliente, receptor y sitio, teléfono/RFC cuando
  están guardados, cuenta, fechas, reparto, remanente, favor, deuda y firmas.
  No usa IDs como sustituto de identidad humana ni consulta saldos actuales.
- La solicitud de impresión se audita **antes** de abrir `window.print()`.
  Un error es visible y permite reintentar, sin impresión silenciosa ni otro cobro.
  La marca de copia/reimpresión incluye fecha; no se afirma impresión física
  exitosa porque el usuario puede cancelar el diálogo.
- Cachés de cliente/pagos/estado/crédito, contexto de caja/cortes y recibos se
  invalidan tras confirmar. Los listados tienen refetch al montar y actualización
  periódica. Solo ADMIN solicita/muestra recibos, incluso con datos en caché.

## A5: medición digital real, no número de filas supuesto

Cada hoja mide 210 × 148 mm, con 5 mm interiores en cada borde. Se miden en DOM
real los encabezados, filas, pie y firmas después de cargar fuentes. La capacidad
se calcula para la evidencia concreta: no hay constante estimada de diez filas
que corte nombres o firmas. Si una fila/encabezado no cabe, se explica y se impide
imprimir; no se recorta evidencia para forzarla.

Se paginan por separado Copia Cliente y Copia Tienda. En Chromium aislado, con
nombre largo y **50 notas**, ambas copias produjeron **10 páginas**. Las 100 filas
se conservan, los pies quedan dentro del margen y fuera de la tabla. El PDF real
producido por `Page.printToPDF` tuvo esas mismas 10 páginas (ninguna en blanco) y
MediaBox `0 0 594.95996 420` puntos: A5 horizontal con el redondeo de Chromium.
La prueba no se limita a buscar texto CSS ni a leer atributos inline.

**Pendiente del propietario:** papel, margen no imprimible de su equipo, corte,
firmas y legibilidad en la impresora física. El PDF digital no acredita esa prueba.

## Pruebas nuevas: cada una observada roja con su defecto y verde restaurada

Archivo único: `src/components/e3-ui.observable.test.ts`.
Se montan componentes y hooks de producción en el fixture Chromium existente.
Las respuestas de red se sustituyen por fixtures exclusivos de pruebas; las
solicitudes externas se bloquean. No se inició ni consultó la API operativa.

| Prueba | Defecto introducido en módulo temporal | Fallo observado |
|---|---|---|
| geometry | Eliminar corte por altura disponible | `E3_GEOMETRY: paginate both copies` |
| advance | Llamar retenido pendiente al anticipo ordinario | `E3_ADVANCE: ordinary advance is not retained` |
| audit | Abrir impresión antes de auditar | `E3_AUDIT: failed audit cannot print` |
| off | Retirar cierre E3 de acceso al recibo | `E3_OFF: no receipt surface` |
| off, mutante adicional catalog | Incluir incondicionalmente los dos módulos E3 | `E3_CATALOG: OFF preserves exact existing 32-module catalog and order` |
| caja | Reintroducir el doble envoltorio `data.data` | `E3_CAJA: flat generated request, no double data` |
| recapture | Enviar sesión de Caja en recaptura | `E3_RECAPTURE: never enters Caja` |

Cada rojo terminó con **exit 1 y AssertionError nominal**, no por falta de archivo,
timeout, importación ni compilación. `frontend-tests/green-before.log`: **6/6**.
`frontend-tests/red-*.log`: siete rojos nominales para seis pruebas, incluido
el mutante adicional de catálogo en `red-catalog.log`. La prueba OFF compara
la lista completa de 32 módulos en orden, no solo su longitud, y comprueba que
los identificadores tipados E3 siguen existiendo.
`frontend-tests/green-restored.log`: **6/6**, incluidos remontaje y reintento con
UUID conservado, contratos reales de hooks, motivo obligatorio y fecha explícita.

Reproducción:

```sh
node scripts/src/frontend-test-runner.mjs --file src/components/e3-ui.observable.test.ts
node scripts/src/frontend-test-runner.mjs --test-name-pattern 'E3 UI caja:|MUTANT_caja' --file src/components/e3-ui.observable.test.ts
node scripts/src/frontend-test-runner.mjs --test-name-pattern 'E3 UI off:|MUTANT_catalog' --file src/components/e3-ui.observable.test.ts
```

Cambiar `caja` por cada nombre de la tabla reproduce su rojo. El runner elimina
variables de entorno; por eso el selector del mutante usa una alternativa del
filtro de nombres. La sustitución copia únicamente el módulo afectado a `/tmp`
y lo remapea en ese proceso. Nunca cambia fuentes vigiladas, dependencias internas
del workspace, paquetes generados ni bundles operativos.

Otras verificaciones:

- `tsc -p artifacts/mariana-textil/tsconfig.json --noEmit --incremental false`:
  exit 0 (`frontend-tests/typecheck.log`).
- Diez regresiones existentes de saldo a favor, captura de autorización y
  ámbito de cartera: **10/10** (`frontend-tests/existing-regressions.log`).
- `git diff --check`: PASS.
- Inventario protegido `/tmp/e3-protected-before.sha256`: PASS sin diferencias.

## Detenido / no acreditado

- Liberación y pruebas con la API/base real: prohibidas y no ejecutadas.
  No hubo reinicio, SQL, cambio de bundle ni build en esta corrección.
- Concurrencia PostgreSQL, instalación/retiro de guardas, permisos efectivos,
  conciliación E2 y pruebas multiusuario reales siguen en el alcance de la
  liberación separada. La UI no activa guardas de efectivo ni migra esquema.
- Dirigido retenido E5/E7 sigue cerrado. No se implementa una simulación de
  aplicación ni favor utilizable para dinero retenido.
- Insuficiencia de evidencia histórica: se muestra el error del servidor; no
  se reconstruyen recibos con saldos actuales. La recuperación de históricos no
  forma parte de esta corrección.
- Geometría extrema que no cabe completa bloquea impresión; requiere decisión
  del propietario antes de introducir otro formato o reducir ilegibilidad.