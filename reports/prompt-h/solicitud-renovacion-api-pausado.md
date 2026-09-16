# Solicitud del propietario — renovar respaldo con API pausado

## Cita textual

> Los cambios que detectaste son de la aplicación viva —bitácora, su secuencia, sesiones y ubicaciones— no de operación de negocio. Confírmame que ninguna tabla de la Lista A cambió de conteo ni de huella entre la captura y el preflight; si alguna sí cambió, eso es otra cosa y quiero saberlo.
>
> Renueva el respaldo con el API pausado, igual que en la purga del 13 de septiembre:
>
> 1. Pausa el servicio del API.
> 2. Toma el respaldo nuevo y verifica su restauración contra la base desechable: 60 tablas, conteos, huellas, columnas, restricciones, índices y los 14 triggers.
> 3. Súbelo a Drive y comprueba el SHA-256 de la copia descargada.
> 4. Corre el preflight con el API todavía pausado, y compáralo contra la captura. Sin escrituras concurrentes, la comparación debe salir idéntica. Si vuelve a diferir, detente y repórtalo: significaría que algo más está escribiendo.
> 5. Preséntame el preflight completo con los conteos de la Lista A que se van a perder, los folios de tickets, notas, rollos y entradas que desaparecen, los seis valores objetivo de la Lista B, y las huellas de la Lista C.
>
> No reinicies el API entre el respaldo y el preflight. Si algo te obliga a hacerlo, dilo en vez de continuar.
>
> Conserva la base desechable de verificación hasta que todo cierre. La purga sigue sin autorización: te la daré por escrito después de ver el preflight.

## Alcance

Se autoriza pausar el API y renovar respaldo, restauración, comprobación de Drive y preflight. **No se autoriza la purga, ningún reinicio de contadores ni reiniciar el API.** La aprobación anterior de listas y objetivos sigue vigente. La hora exacta del mensaje no se presume; los instantes de las operaciones quedan en sus evidencias.

El API se detuvo mediante el control de su workflow, sin quitar ni modificar su configuración. Se comprobó estado `finished` y ausencia de puertos abiertos del workflow antes de despachar la captura nueva.