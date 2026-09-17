# Reglas declaradas antes de reescribir los diez casos

Esta tabla se comunicó al propietario antes de modificar los casos. Las
referencias corresponden al contenido de `replit.md` al comenzar el trabajo.
No se cambian las reglas de negocio para satisfacer las pruebas.

| Caso anterior | Comportamiento que debe observar la nueva prueba | Fuente |
|---|---|---|
| `client utility starts visually hidden and exposes a touch-friendly toggle` | Utilidad inicialmente oculta y control que muestra/oculta; deuda y favor separados, favor incluido cero. | `replit.md:760, 997` |
| `cash authorization offers favor without selecting it automatically` | Vista previa de aplicación automática, disponible/aplicado/remanente, sin casilla ni importe manual. El nombre anterior describe una regla retirada y puede sustituirse. | `replit.md:998` |
| `customer-sale assembly keeps a visible circular roll counter in sync with scans` | Contador visible circular que refleja adición y eliminación de rollos. | **No documentado expresamente** en `replit.md`; conservar conducta existente. |
| `realtime cards have fixed order and exactly six cards open their own detail` | Contado, crédito y cuatro señales abren su propio detalle; ventas totales y utilidad no tienen ese detalle. | `replit.md:804-808` |
| `renders principal row and secondary attention row in exact order` | Cifras y señales conservan su orden, también en móvil; cobranza separada entre ambas filas. | `replit.md:800` |
| `invoiced sales are emphasized without changing the normal document label` | Facturada: VENTA FACTURADA, folio y rojo. No facturada: Nota o Ticket y folio según tipo. | `replit.md:105, 112` |
| `reserva espacios separados para cantidad, unidad y cámara en la captura` | Cantidad, unidad y acceso a cámara se presentan sin solapamientos. | **No documentada expresamente** esa distribución en `replit.md`; conservar composición vigente. |
| `kardex document cells keep desktop and mobile resolved-route branches` | Ruta documental resuelta exacta, también en presentación móvil; sin evidencia, no inventar enlace. | `replit.md:145-147, 1212` |
| `Block 4 functionality in ticket detail` | Estado canónico mediante insignia, sin incorporar el importe; saldo y vencimiento separados y controles vigentes del detalle. | `replit.md:991-993` |
| `monetary profit labels use Utilidad while percentages remain Margen` | Ganancia monetaria se llama Utilidad; porcentaje se llama Margen. | `replit.md:758` |

La documentación de Caja usa “Ventas (Total)” para la categoría; la etiqueta
visible actual es “Ventas totales”. La prueba de orden conserva la presentación
vigente, no restaura el rótulo anterior.

## Condiciones de acreditación

- Montar el código real. Los dobles pueden aislar datos, red y proveedores de
  infraestructura, no reemplazar el comportamiento que se está comprobando.
- Comprobar DOM, interacción y, cuando corresponda, estilos calculados y
  geometría. No inspeccionar nombres de variables ni la disposición textual de
  clases, ternarios o condiciones.
- Introducir un defecto semántico en una copia temporal; exigir una aserción
  fallida del proceso real, no un error de preparación.
- Retirar el defecto en la misma copia y obtener aprobación.
- No escribir en base de datos, crear usuarios o sesiones de aplicación ni
  modificar el Prompt P o cerrar su Grupo 1.