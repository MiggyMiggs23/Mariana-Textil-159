# Sonido de notificaciones — corrección y activación

## Causa informada antes de editar

En la fuente anterior, `components/layout/app-layout.tsx:323–327` montaba el
controlador en cada diseño de página. `components/notification-audio-controller.tsx:422–432`
restauraba la activación al montar y llamaba `activateAudio()`, que en
405–408 emitía AVISO incondicionalmente. No era necesario recibir una
notificación nueva para producir ese sonido.

## Cambios

- Controlador único por usuario sobre las rutas. Activación siempre silenciosa.
- Primera respuesta de red como referencia silenciosa; no reproduce el caché
  al recargar. Reconsultar o modificar updatedAt del mismo ID no es evento nuevo.
- Control de encendido/apagado dentro de la campanita, sin botón en encabezado.
- Preferencia por usuario en localStorage, sincronizada entre pestañas.
- Apagar detiene fuentes y vacía cola. Web Locks conserva exclusión entre pestañas;
  sin exclusión disponible no reproduce.
- Alerta nueva: alerta.ogg; nueva notificación de campanita: aviso.ogg;
  pago confirmado: solicitud.ogg. Los tres archivos tienen contenido distinto.
- Pagos POS, ordinarios cliente/proveedor, recibos E3 y recepciones E5 emiten
  únicamente tras respuesta de éxito, con ID estable para evitar duplicados.
  Propuestas, aplicaciones y recaptura histórica no se cuentan como dinero nuevo.
- Retirados sonidos locales de búsqueda, validación y agregado al carrito.

## Pruebas

Evidencia y comandos completos:
`artifacts/mariana-textil/reports/notification-audio-20260925/evidence.txt`.
Fuente anterior aislada: fallo real por AVISO inesperado, no error de preparación.
Candidato: seis pruebas montadas aprobadas y cuatro contratos aprobados.
Cubren navegación/recarga silenciosas, nueva alerta, reconsulta, preferencia,
apagado, sonidos distintos, deduplicación por pago, exclusividad y usuario.
Typecheck frontend y build Vite aprobados.

`captura.mts` usa la pantalla servida y el menú real con respuestas sintéticas
interceptadas: encender → apagar → encender y preferencia guardada. No login
real, pagos ni escrituras de negocio. Captura `menu-campanita.png`.

## Versión activa

Frontend `dist-notification-audio-20260925`, workflow web actualizado y reiniciado.
Conserva base servida y cambios E7/selector de auditoría de `.local/e7-text-baseline`.
Solo se copiaron los nueve archivos de audio modificados, que no contenían
cambios comerciales pendientes. API y base de datos sin cambios ni reinicio.
No se activó el candidato de devolución comercial.