# Tanda E · tarea 4 · auditoría inicial de color

Fecha de lectura: 2026-09-23. Alcance estrictamente de solo lectura sobre las superficies nuevas E3, E4, E7, E9 y remate. No se modificaron fuentes. Las líneas son las de esta lectura inicial y deben reubicarse después de integrar la tarea 3.

## Regla canónica

`replit.md:64-80`, en especial `replit.md:68`: el color codifica información, nunca decora; cada uso debe tener un significado explicable en una frase y escrito junto al código. También se respetaron las reglas particulares de E3 (`replit.md:578-586`), E4 (`replit.md:877-902`), E7 (`replit.md:1428-1438`), E9 (`replit.md:1558`) y remate (`replit.md:1570-1578`).

Esta auditoría inventaría las selecciones de color explícitas de estas superficies. Los colores internos heredados de los componentes base (`Button`, `Badge`, campos, foco, etc.) no son decisiones locales de estas pantallas. Blanco/negro y grises usados para contraste, separación tabular o jerarquía tipográfica se registran como neutrales funcionales, no como categorías de estado.

## Inventario semántico

| Color/token | Superficie y líneas | Significado observado | Dictamen |
|---|---|---|---|
| `text-destructive` | E3 recaptura `cliente-e3-recaptura-dialog.tsx:194,260,276,288` | Error de validación del campo inmediato. | Semántico y coherente. Conviene declarar una sola vez junto al formulario que destructivo = error de validación. |
| `text-destructive` | E3 recaptura `cliente-e3-recaptura-dialog.tsx:321-323` | Advertencia previa a crear una constancia histórica sin dinero nuevo. | Semántico, pero ambiguo: comparte rojo con errores aunque aquí no existe error. Recomendar ámbar de advertencia o tono neutro reforzado y documentar su significado. |
| `bg-sidebar` + blanco | E3 pago `cliente-pago-dialog.tsx:377` cuando no hay éxito | Encabezado ordinario del diálogo. | **Decorativo**: no distingue un estado operativo; retirar la pareja cromática o sustituirla por superficie neutra. |
| Esmeralda/verde | E3 pago `cliente-pago-dialog.tsx:377,625-630` | Operación terminada con éxito y recibo generado. | Semántico. Escribir junto al bloque: verde = abono confirmado, no mera vista previa. |
| Ámbar | E3 pago `cliente-pago-dialog.tsx:518-520,588-589`; insignia condicional `571` | Vista previa todavía no registrada, nota aún no saldada o ausencia de notas donde aplicar. | Semántico: pendiente/no confirmado. Añadir comentario local que fije ese significado. |
| Esmeralda/verde | E3 pago `cliente-pago-dialog.tsx:546-552,600-612,654-661`; insignia `571` | Saldo a favor/excedente positivo o asignación saldada. | Semántico. Documentar que verde = resultado favorable ya calculado; en `600-612` aún es proyección, por lo que el texto debe seguir dejando explícito que no está confirmado. |
| `text-primary` | E3 pago `cliente-pago-dialog.tsx:538,581` | Importe proyectado/aplicado destacado. | **Decorativo o insuficientemente definido**: “importe destacado” no es una categoría estable. Usar `text-foreground` con peso tipográfico, salvo que se declare azul/primario = importe aplicado en todas las variantes. |
| `bg-white`, `bg-muted`, `text-muted-foreground` | E3 pago `cliente-pago-dialog.tsx:397-495,532,575,580,625,631-644,671,687`; recaptura `301`; recibo impreso `recibo-e3.tsx:82-92` | Superficie/contraste, contenido secundario, agrupación de resumen y separación de tabla (`#aaa`). | Neutrales funcionales; no clasifican estados. Mantener, con comentarios solo donde una selección pueda confundirse con estado. |
| Ámbar | E4 panel `salidas-dinero-e4-panel.tsx:180` | Ninguno: el borde está siempre encendido aun para salidas ordinarias y estados vacíos. | **Decorativo y además falso aviso**. Retirar `border-amber-200`; usar borde base. |
| Ámbar | E4 panel `salidas-dinero-e4-panel.tsx:242-245`; detalle `salidas-dinero-e4-item.tsx:213-218` | Desbloqueo extraordinario por insuficiencia de Caja/evidencia durable de excepción. | Semántico. Escribir junto al código: ámbar = excepción de desbloqueo, no estado general de E4. |
| Ámbar/rojo/azul/verde | E4 `salidas-dinero-e4-item.tsx:159-170` | `PENDIENTE` / `RECLAMADA` / `RESPONDIDA` / `ACEPTADA`; neutro = `NO_APLICA`. | Semántico y legible también por texto. Añadir el mapa en comentario junto a `getEstadoBadge`; no depender solo del color. |
| Verde/rojo/azul | E4 `salidas-dinero-e4-item.tsx:239-250` | Acción que llevará a aceptar/reclamar/responder. | Semántico si se fija como anticipación del estado resultante; hoy no está escrito junto al código. Añadir comentario o, opción más austera, dejar botones neutros porque texto e icono ya identifican la acción. |
| `text-destructive` | E4 `salidas-dinero-e4-panel.tsx:240,261`; toasts destructivos `salidas-dinero-e4-item.tsx:145-150` | Error de consulta, carga o mutación. | Semántico. Mantener rojo exclusivamente para error en estos puntos. |
| `text-primary` | E4 rama E12 `salidas-dinero-e4-item.tsx:205`; ámbar `207` | Enlace/identificador E12 y desbloqueo E12. | Fuera de la superficie E4 liberada mientras E12 está apagado; revisar por separado al abrir E12. |
| Ámbar | E7 `e7-readers.tsx:69-70` | Retenido con antigüedad de 3 días o más que requiere atención ADMIN. | Semántico y reforzado por texto. Añadir comentario inmediato: ámbar = umbral de atención por antigüedad, no deuda ni saldo a favor. |
| `text-muted-foreground` | E7 `e7-readers.tsx:60-62` | Leyendas/aclaraciones subordinadas. | Neutral funcional; no codifica categoría financiera. |
| `text-destructive` | E9 entregas `e9-entregas-panel.tsx:53,65,201,216`; envío `e9-envio-panel.tsx:84,88,102` | Error explícito de disponibilidad, consulta o mutación, siempre con `role="alert"`. | Semántico y consistente. Un comentario compartido puede fijar rojo = error técnico/operativo, no discrepancia ni investigación. |
| `text-muted-foreground` | E9 entregas `e9-entregas-panel.tsx:28,51,68,111` | Instrucción o metadato secundario. | Neutral funcional. E9 acertadamente no inventa colores para `ENVIADA`, `CONTADA`, `AUTORIZADA` o investigación: esos estados siguen escritos en texto. |
| Sin color explícito | Remate `tarea4-remate.tsx:15-45`, `rollo-remate-panel.tsx:6-18` | Estado y acciones se comunican por texto. | Conforme; no agregar un color meramente para “hacer visible” el módulo. |
| Ámbar | Señal histórica de remate `pages/ticket-detail.tsx:393` | La venta utilizó rollos marcados como remate en el momento de vender. | Semántico, pero falta significado escrito junto al código. Añadir comentario; no debe leerse como marca activa actual ni como error. |

## Recomendaciones exactas para la implementación posterior

1. **Eliminar usos puramente decorativos:** `cliente-pago-dialog.tsx:377` en el encabezado ordinario (`bg-sidebar`/blanco), `salidas-dinero-e4-panel.tsx:180` (`border-amber-200`) y, salvo definición transversal explícita, `cliente-pago-dialog.tsx:538,581` (`text-primary`).
2. **Resolver el rojo ambiguo de recaptura:** `cliente-e3-recaptura-dialog.tsx:321-323` debe ser advertencia ámbar/neutra; reservar `text-destructive` de `194,260,276,288` para errores de validación.
3. **Escribir la semántica al lado del código:** mapa E4 en `salidas-dinero-e4-item.tsx:159`, ámbar excepcional E4 antes de `salidas-dinero-e4-panel.tsx:242` y `salidas-dinero-e4-item.tsx:212`, ámbar de antigüedad E7 antes de `e7-readers.tsx:69`, y ámbar histórico de remate antes de `ticket-detail.tsx:393`.
4. **Conservar E9 austero:** no colorear estados de entrega/investigación sin una decisión semántica; mantener rojo solo en errores y los estados en texto.
5. **No cambiar reglas ni puertas:** estas recomendaciones son exclusivamente de presentación semántica. No requieren ni autorizan tocar gates, permisos, reglas de negocio, API, base, workflows o pruebas.

## Resultado

Hallazgos decorativos claros: **2** (`bg-sidebar` ordinario E3 y borde ámbar permanente E4). Hallazgo cromático sin semántica suficientemente estable: **1** (`text-primary` en importes E3). Ambigüedad semántica: **1** (rojo de advertencia de recaptura frente a rojo de error). Los demás colores explícitos tienen significado informativo defendible, pero varios incumplen la exigencia documental de dejarlo escrito junto al código.