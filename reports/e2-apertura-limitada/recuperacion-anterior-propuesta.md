# Recuperación del servicio anterior — propuesta, no autorización

El workspace se reinició externamente al finalizar la preparación; ambos workflows quedaron detenidos. El bundle anterior existe y conserva SHA-256 `655cad5082301d1456184fac8206f317bc0c88e9a33afe4679f806a62e1010c2`.

**Nota posterior:** la frase anterior describe la observación previa a la recuperación, no el estado vigente. La recuperación fue autorizada condicionalmente y se detuvo: identidad y guardas coinciden, pero el bundle anterior ya había sido reemplazado y hubo escrituras automáticas de inicialización. Ver `recuperacion/resultado.md`. No se arrancó la API ni se eligió otra versión.

## Alcance propuesto para autorización independiente

1. Comprobar por lectura la identidad de la base operativa y el estado de la última operación/corte que el propietario indique. No repetir tickets, pagos, cierres ni otra operación.
2. Mantener ese bundle anterior: no ejecutar build, codegen, los parches de apertura ni el SQL nuevo.
3. Usar su modo de inspección existente, `API_INSPECTION_BOOT=1` y `NODE_ENV=development`, después de comprobar el entorno. El bundle contiene la rama que omite inicializadores, backfill de compras y monitor de stock; no usar el comando normal que reconstruye y arranca.
4. Preparar la configuración de ejecución explícita del bundle anterior y arrancar el frontend sin alterar su código. Cualquier ajuste de configuración se enumera en la autorización; no se hizo durante esta preparación.
5. Conservar todas las guardas de efectivo de crédito, retenidos, atribución y devolución cerradas. No se activa E2 ni la apertura limitada.
6. Comprobar acceso y versión sin crear usuarios/sesiones de ensayo ni operaciones. El propietario continúa únicamente después de conocer si su última operación quedó guardada.

Las operaciones legítimas que el propietario realice después seguirán escribiendo por sus rutas normales. “Sin escrituras de arranque” no significa que la aplicación operativa sea de solo lectura.

Esta propuesta no permite arrancar el clon/restauración E10 que también se detuvo, ejecutar inicializadores, alterar guardas o reparar esquema. Si falta una condición, se detiene y se informa.

La propuesta requiere autorización textual adicional antes de ejecutarse. No es autorización para aplicar el paquete de apertura limitada.