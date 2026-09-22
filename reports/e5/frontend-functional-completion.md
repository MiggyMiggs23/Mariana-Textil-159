# E5 — frontend funcional preparado, OFF

## Estado de entrega

Implementación de fuentes completada contra `frontend-contract.md` y los 14
hooks generados. Se incorporó la ampliación contractual de movimiento exacto
por asignación y favor explícito. `E5_ENABLED` permanece `false`, sin overrides.
No se afirma que backend/dependencias estén activos ni que existan validaciones
dinámicas ejecutadas por este implementador.

No hubo apps, tests, SQL, workflows, instalaciones, activaciones ni commits.
No se editaron backend, contratos/generados, harnesses, E9 validada, fuentes E3,
paquetes/dist ni reportes sellados. Los cambios concurrentes de esos ámbitos
pertenecen a sus propietarios.

## Fuentes de esta entrega

Prefijo `artifacts/mariana-textil/src/`:

- `components/e5-pendientes.tsx`: boundary OFF, disponibilidad y capacidades,
  entrada Caja/Cliente, selector autorizado con error de dependencia explícito,
  recepción, vista previa/confirmación, lista paginada/filtrada, avisos ADMIN,
  detalle, preparación, autorización parcial, rechazo y devolución.
- `hooks/use-e5-actions.ts`: despacho de mutaciones generadas, aritmética decimal
  canónica, identidad de intención, lock síncrono, recuperación persistida,
  comprobación de identidad/scope, errores y actualización de consultas.
- `pages/e5-documento.tsx`: acceso ADMIN, snapshot inmutable, paginación medida,
  dos copias A5 horizontal, motivo e impresión/reimpresión auditada.
- `App.tsx`: montaje protegido de `/cobros/pendientes`,
  `/cobros/pendientes/:id` y
  `/cobros/pendientes/:id/documentos/:documentoId`, sólo dentro del gate E5.
- `pages/cobros.tsx`: entrada real en cartera, pasando el cliente de la nota
  resuelta cuando existe, sin reemplazar FIFO ni el abono E3.
- `pages/cliente-detail.tsx`: recepción CLIENTE y lista contextual junto al
  estado de cuenta/historial autorizado. No es recaptura.

El gate ya preparado en `lib/e5-feature-flags.ts` no fue modificado.

## Trazabilidad de los 14 hooks

| Hook | Consumidor y efecto UI |
| --- | --- |
| `useGetE5Disponibilidad` | Boundary; cierre explícito del servidor y capacidades |
| `useGetE5Contexto` | Recepción/detalle; notas, cargos, saldos, sesiones y versión |
| `useListE5Cobros` | Bandeja y lista por cliente, estado/cursor |
| `usePreviewE5Cobro` | Revisión real previa a recibir |
| `useCreateE5Cobro` | Confirmación de recepción e inmediata evidencia enlazada |
| `useGetE5Cobro` | Detalle, revisión fresca y pertenencia de documentos |
| `useCreateE5Propuesta` | Preparación multinota/multicargo sin aplicación |
| `useAuthorizeE5Aplicacion` | Subconjunto explícito aprobado, parcial o completo |
| `useRejectE5Propuesta` | Rechazo motivado; dinero permanece retenido |
| `useGetE5DevolucionOpciones` | Elegibilidad y fuentes actuales, sólo ADMIN |
| `useReturnE5Cobro` | Devolución íntegra, petición/evidencia y fuente verificadas |
| `useListE5Avisos` | Avisos ADMIN de servidor en Caja y bandeja |
| `useGetE5Documento` | Snapshot de recibo/constancia, no saldos actuales |
| `useRecordE5Impresion` | Solicitud de impresión/reimpresión previa a imprimir |

## Autorrevisión funcional y de seguridad

- OFF no monta queries/mutaciones E5, navegación, entradas ni impresión.
  Disponibilidad cerrada/error no se transforma en cero o lista vacía.
- Queries E5 segregadas por actor/sitio; remount al cambiar identidad, rol o
  sitio. Antes de mutar se refresca identidad y se comprueba revisión/contexto.
  El servidor conserva autoridad final bajo concurrencia.
- Contexto autoritativo, sin fabricar `versionContexto`. Cambios de notas,
  saldos, sesiones o facultades obligan a revisar; no hay sustitución FIFO.
- `notasIndicadas` son documentos únicos. La exactitud no ADMIN suma todos
  sus cargos. Captura de repartos usa `movimientoVentaId` como identidad
  única y envía también `notaId`; nunca distribuye a todos los cargos de un
  ticket por inferencia.
- EFECTIVO usa sesión física y CAJA_FISICA. TRANSFERENCIA exige cuenta real
  del enum y no envía sesión física. Entrada CAJA conserva sesión operativa
  aun por transferencia; CLIENTE no se convierte en recaptura.
- ADMIN puede recibir/aplicar atómicamente mediante `aplicarAhora`.
  Preparación A sólo por capacidades futuras explícitas, nunca por inferir
  que todos los CONTADOR son A; A no aplica/aprueba ni prepara favor.
- Autorización parcial sólo sobre movimientos/importes propuestos. Una nota
  cambiada/pagada detiene la propuesta; cualquier residual tras aplicación
  queda marcado no devolvible. Rechazo no devuelve ni elimina recepción.
- Favor ADMIN opcional explícito, cero al omitir, autorización no mayor a lo
  propuesto y suma dentro del retenido. Se admite reparto vacío sólo con
  favor positivo. No se consulta deuda global fuera de alcance: el backend
  debe validar proyección global sin deuda antes de producir favor.
- Devolución no tiene input de importe. Requiere total íntegro nunca aplicado,
  petición expresa y evidencia, y fuente actual ofrecida por backend:
  CAJA/CUENTA/FONDO. No se inventa saldo/disponibilidad ni se invierte E9.
- No hay saldo Fondo ni enlaces privados de Fondo para no ADMIN. Documentos
  completos e impresión sólo ADMIN con capacidad vigente; los textos de
  evidencia/referencias no se ejecutan ni descargan como URLs.
- Intenciones normalizadas usan UUID estable al reintentar; contenido diferente
  obtiene otra clave. Ref síncrono antes de await. Persistencia antes de enviar;
  respuesta incierta congela la intención y ofrece reintento exacto, no un nuevo
  cobro. La recuperación comprueba scope/cliente/entrada/recepción.
- Resultados monetarios provienen de respuesta backend; después de éxito se
  invalidan E5, clientes/crédito/estado de cuenta/pagos, Caja y fuentes afectadas.
  Un error de refresco posterior no vuelve a registrar el dinero.
- Recibo inmediato se enlaza tras recepción confirmada, sin impresión automática.
  Aplicación enlaza constancia diferente; el recibo original no se reescribe.
- Documento usa exclusivamente snapshot: folios, cargos, actores, importes,
  favor generado cuando existe y fechas originales. No reconstruye evidencia
  ausente. Paginación mide fuentes/filas/márgenes/footer; si el contenido no
  cabe íntegro, bloquea imprimir en vez de recortarlo. Dos copias con firmas.
- Impresión registra motivo y UUID antes de abrir impresora; fallo/cancelación
  no repite recepción ni aplicación. Una solicitud incierta conserva su clave.
- Selector Caja reutiliza el contexto autorizado E3, pero muestra explícitamente
  dependencia E3 cerrada/error, en vez de sugerir que no existen clientes. El
  cliente ya identificado por nota/ficha entra directamente a contexto E5.

## Verificación estática realizada

Typecheck de fuentes del frontend mediante API TypeScript, leyendo su tsconfig,
con `noEmit:true`, `incremental:false`, `composite:false`, sin pasar referencias
de proyecto a `createProgram`. Ejecutado desde `artifacts/mariana-textil`:
`STATIC_NO_EMIT_DIAGNOSTICS=0`.

No hubo generación de dist, buildinfo ni ejecución de harnesses. El primer
intento desde raíz no resolvió correctamente los type roots Node/Vite; se
corrigió el cwd y el typecheck completo quedó sin diagnósticos. No se alteró
tsconfig ni se instalaron dependencias para resolverlo.

Pendiente de MAIN: pruebas dinámicas/mutantes y validación visual/impresión
contra backend estable. La preparación de fuentes no autoriza activar E5,
E3, E7, E11 ni productores cerrados.