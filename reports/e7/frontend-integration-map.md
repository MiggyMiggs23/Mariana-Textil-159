# E7 frontend OFF — mapa previo al contrato

Estado histórico de preparación (integración posterior documentada en
`frontend-functional-completion.md`): pendiente del contrato backend coordinado por MAIN
y de sus clientes generados. No hay hooks, DTOs, endpoints ni motores E7
inventados en esta fase. No se declara implementación funcional.

## Autoridad y límites

Leídos plan U líneas 224–236, autorización Tanda B 20260922, respuestas del
propietario y sección Prompt P/Grupo 1 de replit.md. P9 posterior prevalece:
F conserva lectura exclusivamente fiscal E11; A usa sólo el lector saneado E11.
No conectar contadores con lectores administrativos legacy.
Construcción apagada, sólo consulta; no operaciones nuevas, activación, cambios
a los 69 vetos ni cierre de Grupo 1 o avance de grupos 2–4.
Históricos 51–53 permanecen Sin sitio determinado.

## Padres reales y puntos de integración

- `src/pages/caja/cuentas-destino.tsx`, `CajaCuentasDestino`: filtros reales
  desde/hasta/preset/compare y `selectedLocationId`. Consume
  `src/hooks/use-shared-cuentas-destino.ts`. Integrar respuesta contractual
  en este padre, no crear una pantalla financiera paralela.
- `src/pages/caja/tiempo-real.tsx`, `CajaTiempoReal`: comparte el hook anterior
  con día CDMX; además consume dashboard y desglose paginado propios. El bloque
  E7 debe compartir periodo/scope y no sumar otra vez recepción a cobranza.
- `src/pages/cliente-detail.tsx`, `ClienteDetail`: crédito, estado de cuenta,
  permisos financieros y selección de detalle existentes. Contiene entrada E5
  e historial dirigido: no convertirlos en segundo motor ni duplicar retención
  como favor. Integrar el detalle E7 sólo con permiso/scope contractual.
- `src/pages/e11.tsx`: lector A de estado de cuenta generado y saneado, dentro
  de identidad E11; F y sus rutas fiscales quedan sin ampliar. No reutilizar
  campos financieros administrativos ni enlaces privados en ese adaptador.

## Reglas de presentación que no dependen del DTO

Retención E5 y antigüedad separadas de deuda y favor; recepción contada una vez,
aplicación posterior no es segundo ingreso ni cambio de fecha del cobro.
No calcular FIFO ni atribuir sitio en React: mostrar proyección del servidor.
Aplicaciones por tienda sólo con evidencia comprobada, rotuladas como
aplicaciones y no como recepción allí. Global conserva “Sin sitio determinado”.
No presentar recaptura histórica como ingreso físico nuevo.

Excepción global exclusivamente deuda actual, saldo a favor, límite global y
crédito disponible. Retención no es quinta cifra global sin autorización.
Detalle sólo autorizado. Leyendas literales:

- “El resumen global de crédito considera todos los sitios.”
- “El detalle corresponde solo a los sitios autorizados y no representa la deuda total del cliente.”

Mantener loading/error/vacío separados; error o ausencia no equivalen a cero.
Al cambiar sitio/periodo/identidad no conservar datos privados de otro scope.
No fallback legacy para contadores ni para denegaciones E7.

## Información requerida antes de implementar

MAIN/backend debe fijar gates, endpoints/hooks generados, parámetros y semántica
temporal/scope, respuesta OFF, capacidades/roles, DTOs de recepción/aplicación/
corrección/retención/antigüedad y vínculos de detalle permitidos. Aclarar encaje
con los lectores existentes, paginación, totales canónicos y entrega saneada A.
No inferir esos campos a partir de E5 ni sumar aplicaciones persistidas.

Sólo inspección de fuentes/documentos; no tests, apps, API, DB, SQL, workflows
ni commits. Integración y comprobación estática pendientes del contrato.