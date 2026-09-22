# E12 — cierre de implementación funcional frontend

## Alcance y archivos

Implementación sobre el diseño existente, sin liberar gates.
Archivos productivos editados en esta intervención:

1. `artifacts/mariana-textil/src/components/proveedor-efectivo-e12.tsx` (nuevo): captura compartida, parser de centavos, disponibilidad, validación Caja/Fondo, UUID por contenido, evidencia e invalidaciones.
2. `artifacts/mariana-textil/src/components/proveedor-pago-dialog.tsx`: integración real FIFO y dirigido, campos editables, confirmación fresca y respuestas.
3. `artifacts/mariana-textil/src/components/solicitud-pago-dirigido-dialog.tsx`: segunda entrada dirigida PROVEEDOR integrada, sin agregar campos E12 a CLIENTE.
4. `artifacts/mariana-textil/src/components/proveedor-compra-detalle.tsx`: evidencia y reversión completa con naturaleza explícita; reutilización como detalle de pago independiente de compra.
5. `artifacts/mariana-textil/src/pages/proveedor-detail.tsx`: evidencia de movimientos y acceso al detalle/reversión desde estado de cuenta, incluidos pagos sin aplicaciones a compras.
6. `artifacts/mariana-textil/src/pages/pagos-dirigidos.tsx`: propuesta persistida, disponibilidad, aprobación sin editar reparto y evidencia de respuesta.
7. `artifacts/mariana-textil/src/components/salidas-dinero-e4-panel.tsx`: P12 consume saldo del corte servido, validación compartida, motivo ADMIN, snapshot de sesión y protección durante consulta.
8. `artifacts/mariana-textil/src/components/salidas-dinero-e4-item.tsx`: metadata E12 tipada y presentación exclusiva ADMIN con gate.
9. `artifacts/mariana-textil/src/components/corte-efectivo-desglose.tsx`: presentación del sumando servido y naturaleza de retornos, enlaces de proveedor; sin recalcular el efectivo esperado.

No se editó `corte-detail-shared.tsx`: ya monta el lector común modificado.
Este informe es el único archivo no productivo escrito por esta intervención.

## Autorrevisión contra contrato (lectura de código, no pruebas funcionales)

- FIFO utiliza `useRegistrarPagoProveedor`; dirigido en ambas entradas utiliza
  `useCreateSolicitudPagoDirigido`, incluyendo realmente `efectivoE12`.
  Tipos y hooks proceden del cliente generado, sin DTO monetario paralelo.
- El parser rechaza negativos, más de dos decimales y desajuste incluso de un
  centavo. Caja/Fondo se serializan con dos decimales. No se admiten CHEQUE/OTRO
  como nuevas opciones ni se adjunta E12 a medios no efectivos.
- Consulta de opciones condicionada por E12, formulario abierto y EFECTIVO.
  Las claves incluyen identidad/contexto del usuario; refresco al activar,
  por foco, por intervalo y explícitamente antes de confirmar.
- Fondo y su saldo requieren ADMIN y respuesta autorizada. Caja-only usa el
  total; Caja positiva requiere sesión Mariana informada por servidor.
  Fondo puro envía sesión null y no abre turnos. No hay sobregiro Fondo.
- Sobregiro Caja exige ADMIN, capacidad de desbloqueo y motivo explícito
  hasta 1000 caracteres. No se reintenta automáticamente ante insuficiencia.
  Los errores se muestran usando el lector de errores de dominio existente.
- Ref síncrono de doble envío antes de cualquier `await`; borrador conservado
  al fallar, liberación en error y `onSettled`; edición/cierre bloqueados durante
  envío. UUID se conserva ante error del mismo contenido y cambia al enviar otro
  contenido. Capturas incluyen importe, fuentes, cuentas, fechas, notas, motivos,
  documento, sesión e identidad. E4 incluye sesión y tienda.
- Respuestas FIFO, propuestas dirigidas y aprobación presentan las fuentes
  autorizadas, sin reconstruir Fondo cuando falta metadata. Pendiente se
  distingue de dinero aplicado.
- Retorno no ofrece importes/destinos editables. Naturaleza inicialmente vacía:
  corrección de captura o recuperación física. Motivo obligatorio; se informa
  que Caja retorna a la sesión actual y no altera cortes cerrados. El servidor
  deriva sesión e importes. Se bloquea un retorno ya informado.
- Caso no ADMIN: el contrato omite por completo la identificación E12 del pago.
  No se infiere que sea histórico ni se inventan fuentes. Si el reversor existente
  responde `E12_RETURN_REQUIRED` (código observado en la implementación backend
  actual), se conserva el formulario y se exige naturaleza para un nuevo envío
  explícito. No hay reenvío automático. Este recorrido necesita cobertura tandem.
- Propuesta dirigida se muestra sin campos editables de reparto. Antes de
  aprobar se compara sesión persistida con disponibilidad; una sesión cerrada
  exige resolver/preparar otra intención. UUID de aprobación incluye propuesta
  y motivo; el servidor sigue siendo autoridad.
- P12 requiere E4 y E12. Usa `efectivoEsperado` servido por corte y el helper
  compartido `cajaOverrideProblem`; no arma otra cuenta con tickets/movimientos.
  Sólo añade autorización a la salida existente: no crea otro pago/egreso local.
  No ofrece Fondo en E4 ni autorización de caja a medios no físicos.
- Lector de E2 presenta retornos positivos y naturaleza. Conserva el total
  servidor, sin sumarlo localmente ni reclasificarlo como venta/cobranza.
- Invalidación E12 por predicado sobre las URL completas de los getters:
  proveedores (lista/detalle/compras/estado/opciones), solicitudes, sesiones,
  cortes y salidas. Fondo únicamente ADMIN. Se mantienen claves legadas fuera
  del recorrido E12.
- Enlaces de corte usan `/caja/cortes?sesionId=...`; Fondo usa su ruta existente
  `/fondo/movimientos/:id`, sin activar menú/rutas ni gate E10.
- Se mantienen `E12_ENABLED=false`, E3/E4 y los demás gates. Las nuevas consultas
  de opciones/P12 quedan deshabilitadas OFF. No se modificaron contratos
  generados, backend, SQL, DB, paquetes, workflows, runners ni pruebas.

## Verificación observada y pendiente

- Se ejecutó únicamente comprobación estática:
  `pnpm exec tsc --noEmit -p artifacts/mariana-textil/tsconfig.json --pretty false`.
  Última ejecución: salida vacía, exit 0.
- `git diff --check` limitado a los nueve archivos anteriores: última ejecución
  sin salida, exit 0.
- No se arrancó la aplicación, no se ejecutaron tests, no se hicieron
  experimentos HMR, SQL, llamadas financieras reales ni commits.
- No se observó comportamiento en navegador, integración transaccional,
  concurrencia, permisos reales ni reintento de red. No se declara PASS
  funcional. MAIN y tandem deben ejecutar sus verificaciones, incluyendo
  transiciones de usuario/rol, ambas entradas dirigidas, no ADMIN con
  `E12_RETURN_REQUIRED`, Fondo puro, sobregiro Caja, retorno y aprobación.