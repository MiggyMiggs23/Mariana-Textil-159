# Prompt G — entrega detenida por límite de alcance

**Registro histórico:** el propietario autorizó posteriormente la ampliación mínima y se resolvió el bloqueo del contrato. La evidencia corregida pasa por el parser real. El estado vigente y sus límites están en `entrega.md`; queda pendiente la activación de API.

La revisión confirmó que `TicketDetalle` y `ObtenerTicketResponse` no incluyen `autorizacionEstado`. Aunque el lector del servidor selecciona ese campo, el parser lo elimina antes de enviar el detalle.

Por ello, el rótulo “Nota autorizada” no se puede resolver por ese campo en la respuesta actual. El fixture del navegador lo incluía artificialmente: la evidencia de esa insignia quedó invalidada y los reportes se marcaron como parciales/bloqueados.

Se detuvo la implementación sin modificar contrato, consultas, reglas de negocio ni datos. No se reinició la API. No se presenta la entrega como completa.

Los cambios de rótulos y unidades permanecen en el código de trabajo. La revisión también señaló textos de error provenientes del servidor que todavía pueden decir “Ticket”, y el caso de tipo vacío del helper. No se afirma haber cerrado esos puntos.

La comprobación de cantidades sí constató que la composición existente no se solapa en escritorio ni a 402 px, incluyendo 309 dígitos finitos. No se cambió esa composición; se retiró únicamente el rótulo manual “Piezas” para usar `formatUnit` y mostrar “Pzas.”.

El typecheck recursivo ejecutado terminó con cero errores en todos los paquetes seleccionados. Esto no demuestra que un campo ausente llegue al navegador. No hubo sesión autenticada disponible ni se crearon usuarios, sesiones o movimientos de prueba.