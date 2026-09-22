# E9 — implementación funcional frontend, construida OFF

## Fuentes entregadas

Nuevos archivos productivos:

- `artifacts/mariana-textil/src/components/e9-entregas-panel.tsx`
  — disponibilidad, lista por tienda/estado con cursores, detalle, cronología,
  conteo, autorización de recepción y cierre documental.
- `artifacts/mariana-textil/src/components/e9-envio-panel.tsx`
  — envío completo desde el corte cerrado, confirmación y evidencia.
- `artifacts/mariana-textil/src/lib/e9-ui.ts`
  — dinero decimal sin floats, normalización de evidencia, errores E9,
  alcance del contexto e invalidación por URL.

Integraciones sobre superficies existentes:

- `artifacts/mariana-textil/src/pages/caja/cortes.tsx`: sección propia de entregas
  usando la selección de tienda existente.
- `artifacts/mariana-textil/src/pages/corte-detail-shared.tsx`: desde corte cerrado
  monta el envío. Tras revisión visual estática se retiró la lista completa de
  tienda del modal: permanece únicamente en la página Cortes. No se modificaron
  el feedback del envío ni los flujos de consulta/recepción de la lista paginal.

No se añadieron sidebar ni rutas globales. No se rediseñó el producto.
`E9_ENABLED=false` se conserva sin modificar. No se editaron backend,
generados, pruebas, runners, paquetes, E3 ni otros gates.

## Dependencia canónica resuelta

Inicialmente faltaba `versionCorte` en el lector de cortes. Se escaló a MAIN,
sin fabricar un token. Durante esta intervención backend/codegen incorporaron
el campo opcional y actualizaron `frontend-contract.md`.

El frontend ahora usa exclusivamente `useObtenerCorteCaja(corteId)`:
`CorteCaja.versionCorte`, `sesion.id`, `sesion.ubicacionId`, estado cerrado y
`efectivoContado`. No deriva versión de fecha/monto/ID. Si falta el token,
explica la ausencia de evidencia canónica y no habilita envío.

## Autorrevisión de requisitos (inspección de fuentes)

### Gate, alcance y privacidad

- Las dos entradas públicas son wrappers sin hooks E9: OFF retorna null sin
  montar consultas, mutaciones, botones ni contenido nuevo.
- ON exige usuario y permiso existente de consulta de cortes. Envío además
  exige ADMIN/SUPERVISOR y capacidad `puedeEnviar` de disponibilidad vigente.
- Selección tienda reutilizada; actores PROPIA/CAJA/TERMINAL quedan restringidos
  a su ubicación asignada. Servidor conserva autoridad sobre alcance.
- Disponibilidad se valida contra sitio solicitado; lista/detalle también
  verifican correspondencia de sitio. Errores no se convierten en listas vacías
  ni éxito; ante error de lectura no se presenta detalle privilegiado cacheado.
- Claves incluyen identidad/rol/permisos/contexto y sitio. Cambio de contexto
  remonta borradores, refs y selección. La limpieza marca detalle viejo obsoleto
  sin ejecutar lecturas con el actor nuevo.
- Un contexto desmontado no puede continuar desde un await previo hacia otra
  mutación. Respuestas tardías no actualizan la interfaz del actor nuevo.
- Tiendas ven estados, importes, evidencia y cronología propios. No se muestran
  `fondo`, ID/enlace de su movimiento ni saldo/historial de Fondo a no ADMIN.
  No hay consulta de saldo Fondo en E9.

### Envío

- Parte del corte cerrado seleccionado. Consulta canónica y total físico
  contado congelado; no hay editor de importe.
- No descuenta fondo inicial, reserva cambio, usa ventas/esperado, cambia
  cierre, requiere E5 ni transforma cobros retenidos.
- Cierre sin efectivo positivo o sin token no enviable. No genera asiento cero.
- Captura descripción y referencias documentales; muestra corte, tienda y fecha
  original de cierre. No inventa autor/fecha de auditoría.
- Ref síncrono antes de await; revalida capacidad, versión, sitio, ID, estado
  cerrado e importe antes del POST. Versión distinta exige revisión y otra
  confirmación, nunca sustitución silenciosa.
- Usa `useCreateE9Entrega`; cuerpo sólo contrato, con token copiado intacto.
  La respuesta completa se conserva; éxito informa envío, no recepción.

### Conteo y recepción

- ADMIN más capacidades del detalle vigente para contar/autorizar.
  SUPERVISOR no ve esos controles, aunque una respuesta inconsistente incluya
  capacidades administrativas.
- `useCreateE9Conteo` captura importe real no negativo con máximo dos decimales
  y evidencia. Cada POST registra nuevo conteo; no hay edición/borrado previo.
- Cero se permite como evidencia, queda pendiente, no ofrece autorización.
  La protección se repite en el submit; nunca se manda una autorización cero.
- `useAuthorizeE9Recepcion` utiliza el ID de conteo fijado al abrir la
  confirmación, no el que pueda aparecer después por polling.
- Antes del envío compara conteo vigente (CAS). No sustituye un conteo
  obsoleto ni modifica el reparto/importes.
- Diferencia no cero requiere motivo explícito. Confirmación distingue ingreso
  único por dinero real, independiente de turno Caja, e investigación que
  continúa abierta. El frontend no crea movimientos de Fondo directamente.
- Una autorización confirmada elimina controles de conteo/segunda autorización.
  El servidor conserva unicidad transaccional.

### Investigación, fechas e historial

- Se consume investigación creada por servidor ante discrepancia; frontend no
  inventa investigación ni calcula ajustes monetarios.
- `useCloseE9Investigacion` exige ADMIN, capacidad, estado ABIERTA, conclusión
  y evidencia. Declara expresamente cierre documental, no conciliación,
  condonación, recuperación, pérdida ni ajuste.
- Se mantienen enviado, conteos, recibido, diferencias e investigación aun
  después del cierre. Ausencia de conteo/investigación no se representa como
  diferencia monetaria cero.
- Cronología ordenada por fechas de eventos servidor, con autor/evidencia de
  envío, todos los conteos, apertura, autorización y cierre.
- Fecha de corte, envío, conteos y autorización permanecen separadas; no se
  limita a un mismo periodo.
- Evidencia del contrato es texto con referencias: descripción 1–2000, hasta
  20 referencias de 500 caracteres, normalizadas. No hay upload, descarga
  arbitraria, editor de auditoría ni campo URL de archivo inventado.

### Idempotencia, errores, datos frescos

- Todos los escritores bloquean doble envío con ref antes de await y deshabilitan
  edición/cierre mientras están pendientes. Error conserva borrador y UUID.
- Snapshot normalizado incluye actor/contexto, sitio, entrega o corte, acción,
  versión/conteo, importe decimal, evidencia y motivo/conclusión aplicables.
  UUID cambia sólo ante distinto contenido; no se regenera por timeout.
- Reintento explícito de idéntica intención ya enviada conserva UUID incluso si
  una consulta posterior refleja estado avanzado. El servidor debe resolver
  idempotencia o conflicto: no se genera automáticamente otro conteo/ingreso.
- Error anidado `{error:{code,message}}` se muestra con su código y mensaje.
  Hay consulta de estado y controles para reintentar lecturas.
- Mutaciones actualizan detalle desde respuesta y después invalidan URL completas
  de getters E9, cortes administrativos y sesiones/corte.
- Fondo sólo se invalida después de autorización ADMIN en contexto todavía
  activo; envío, conteo y cierre documental no disparan lecturas Fondo.
- Polling/foco/montaje mantienen lista, disponibilidad y detalle frescos.
  Confirmación reconsulta lecturas aplicables antes del productor; disponibilidad
  no se presenta como reserva.
- Enlace de Fondo sólo ADMIN, desde `fondo.href` autorizado y limitado a la
  ruta existente. No habilita navegación E10.

## Verificación estática observada

No se ejecutaron aplicaciones, pruebas, mutantes, workflows, SQL, DB ni API real.
No se escribieron dist ni se instalaron paquetes. No hay commits. El comando
final de verificación deshabilita incremental y no escribe build-info.
No se afirma PASS funcional, de concurrencia ni de integración.

El `tsc --noEmit` habitual con referencias de proyecto inicialmente resolvió
declaraciones anteriores del cliente (no encontraba los nuevos exports E9).
No se regeneraron ni escribieron dist para corregir eso. Se comprobó el
frontend contra fuentes actuales con TypeScript y referencias de proyecto
vacías en memoria, conservando su configuración. Última ejecución: salida vacía,
exit 0. Comando reproducible:

```sh
cd artifacts/mariana-textil && node --input-type=module <<'JS'
import ts from 'typescript';
import path from 'node:path';
const file = path.resolve('tsconfig.json');
const config = ts.readConfigFile(file, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(
  config.config, ts.sys, path.dirname(file),
  { incremental: false, noEmit: true }, file
);
const program = ts.createProgram({
  rootNames: parsed.fileNames,
  options: parsed.options,
  projectReferences: []
});
const diagnostics = ts.getPreEmitDiagnostics(program);
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: x => x,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => '\n'
}));
process.exitCode = diagnostics.length ? 1 : 0;
JS
```

`git diff --check` limitado a las fuentes de esta intervención terminó sin
salida, exit 0. MAIN y el ingeniero tandem deben ejecutar las verificaciones
funcionales, de permisos/contexto, CAS, timeout/idempotencia y regresión OFF.