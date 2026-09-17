# Prompt G — corrección preparada; activación de API pendiente

## Resultado

- El propietario autorizó la ampliación mínima: `TicketDetalle.autorizacionEstado`, opcional y con el enum existente, ahora se conserva en la respuesta generada. No se añadieron consultas ni se cambiaron reglas de negocio.
- `documentoTipoLabel` centraliza el nombre en detalle, acciones y diálogos de cancelación, mensajes conocidos del servidor, listado de Cobros y referencias de movimientos en Producto/Ajustes. Los errores sin tipo disponible usan Documento; los mensajes desconocidos conservan su causa original.
- La insignia de documento distingue **Nota autorizada / Nota por autorizar** de **Ticket cobrado / Ticket por cobrar**. No se infiere autorización desde `cobrado`. Las respuestas incompletas muestran falta de confirmación.
- Verde: procesamiento del documento en Caja completado, no deuda pagada. Ámbar: acción de Caja pendiente. Azul: procesamiento sin confirmar. Los comentarios están junto a las clases correspondientes.
- La insignia de cobranza de la nota, sus estados y colores permanecen intactos.
- Captura ya tenía input y unidad separados. No se reprodujo solapamiento, tampoco con 309 dígitos finitos a 402 px y escritorio. No se cambió composición ni validación. Se retiró “Piezas” manual: ahora usa `formatUnit` y muestra “Pzas.”.
- Se conservaron `/tickets/:id`, enlaces y documentos impresos.

## Evidencia y límites

La primera prueba de insignia no era válida: añadía un campo ausente del contrato. Tras la autorización y corrección, se repitió el flujo con el fixture pasando por **ObtenerTicketResponse.parse antes de enviarlo al componente**, sin añadir campos después. La nota sintética 9001, con AUTORIZADA, `cobrado=false` y ABONO_PARCIAL, mostró **Nota autorizada** y **ABONO PARCIAL** separadamente en escritorio y a 402 px.

Las capturas comparativas están en `montages/`. Son pruebas aisladas de componentes reales con datos sintéticos, **no una comprobación autenticada de la nota 1005**. La vista previa real solo mostró login; no se crearon usuarios, sesiones ni movimientos de prueba. No se enviaron mutaciones reales.

Las últimas correcciones de gramática en mensajes de cancelación y permiso se confirmaron con seis pruebas enfocadas y typecheck frontend, no con otra ejecución de navegador. Las capturas de encabezado e insignias no dependen de esos mensajes.

## Verificación

Codegen repetido estable; builds API y frontend aprobados. Diez pruebas enfocadas de la tanda contractual y dos pruebas de API aprobadas. Tras las últimas correcciones de texto, seis pruebas de nombres/superficies y typecheck frontend aprobados.

`pnpm run typecheck` completo: **0 diagnósticos**. Resultado por paquete:

| Paquete | Errores |
| --- | ---: |
| @workspace/scanned-code | 0 |
| @workspace/number-format | 0 |
| @workspace/metered-pricing | 0 |
| @workspace/db | 0 |
| @workspace/api-client-react | 0 |
| @workspace/api-zod | 0 |
| @workspace/api-server | 0 |
| @workspace/mariana-textil | 0 |
| @workspace/mockup-sandbox | 0 |
| @workspace/scripts | 0 |

La etapa agregada `@workspace/libraries` también terminó en cero. Evidencia en `typecheck-root-final.log`, `typecheck-final-wording.log` y `test-final-wording.log`. No se afirma aprobación de toda la suite histórica.

## Activación pendiente

El workflow de API informa EADDRINUSE. Se confirmó de solo lectura que un proceso anterior de la propia API conserva el puerto 8080. No se detuvo ni se reinició la API en esta ampliación.

Activar el contrato requiere reemplazar el proceso anterior y arrancar normalmente la API. Sus inicializadores pueden escribir en la base; esta autorización de cambio de contrato no cubre ese reinicio. No se publicó una versión.