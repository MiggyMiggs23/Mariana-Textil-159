# Cartera por sitio — implementación conjunta

## Estado

Código y verificaciones aisladas terminados. **Nueva API activada en desarrollo mediante reinicio normal autorizado expresamente por el propietario.** También se reinició el frontend. Ambos workflows están en ejecución.

La activación se mantuvo pendiente hasta recibir autorización expresa, porque el arranque normal ejecuta inicializadores que pueden escribir en la base y vuelve a iniciar procesos operativos de compras y mínimos. Tras recibirla se ejecutó el reinicio normal, sin modo de inspección ni deshabilitar procesos. Los inicializadores terminaron sin errores; el backfill de compras informó cero inserciones. Evidencia de arranque: `activation-api.log` y `activation-web.log`.

Después del reinicio, las cuatro rutas (resumen, cartera, XLSX y PDF) respondieron HTTP 401 a solicitudes sin sesión. La vista previa volvió a mostrar login correctamente. Esta comprobación no crea una sesión ni demuestra la respuesta financiera de un usuario autenticado.

## Entrega indivisible

- Resumen, tabla, Excel y PDF consumen un servicio compartido.
- SQL limita los cargos autorizados por sitio del ticket. La proyección canónica conserva el ledger completo y el reparto existente.
- Global mantiene los cálculos anteriores, incluidos los universos distintos de resumen y filas.
- Uno o varios sitios reciben únicamente sus cargos pendientes y conteos distintos de clientes con notas allí.
- Los cargos sin sitio atribuible permanecen en global. El saldo a favor por sitio no se filtra desde una cifra global: el servidor devuelve `null` y las exportaciones explican que no es atribuible.
- Pantalla y archivos identifican el alcance efectivo. Las descargas directas también usan el servicio compartido.
- La caché financiera se separa por identidad/rol/alcance/sitio y se rechazan respuestas incompatibles. Caja permanece en su sitio incluso con TODAS histórico.

## Verificación ejecutada

1. **Global real, solo lectura:** comparación ejecutable con el código anterior fijado a una revisión inmutable, dentro de REPEATABLE READ / READ ONLY. Resumen y filas coinciden. La base actual tiene cero filas de cartera con deuda, por lo que esta comparación no acredita casos positivos. `readonly-verification.json` y `readonly-verification-command.log`.
2. **Global positivo aislado:** proyección canónica y código anterior ejecutados con clientes activos, sistema/inactivo, vencimientos mixtos, pago dirigido, reverso y ajuste positivo. Coinciden todas las cifras y campos de filas, además del orden. Resumen sintético: 187.00 de cartera y 87.00 vencido; no son cifras productivas. `positive-global-parity-offline.json`.
3. **SQL real con CTEs VALUES:** selección autorizada de cargos para uno y varios sitios, sin inserciones ni tablas temporales. Evidencia dentro de `readonly-verification.json`.
4. **Servidor y exportadores:** 4 pruebas enfocadas aprobadas, con la proyección canónica, autorización, rechazo de alcance ajeno, favor no divulgado y lectura de XLSX/PDF generados.
5. **Contrato/interfaz:** 8 pruebas enfocadas aprobadas, incluidos cambios de identidad/sitio y Caja/TODAS.
6. **Navegador aislado:** componentes productivos y hooks generados; global → sitio → varios sitios; carga/error/respuesta incompatible; descarga Excel con parámetro correcto; caché compartida al cambiar de usuario; Caja/TODAS y ADMIN/PROPIA. Evidencia `browser-isolated.json`, `.md` y capturas.
7. **Typecheck recursivo:** cero errores en todos los paquetes seleccionados.
8. **Codegen:** regeneración repetida sin cambios en archivos generados.
9. **Build:** API y frontend compilados correctamente, sin arrancar la API.
10. **Revisión de alcance:** sin bloqueantes después de corregir aislamiento de caché y Caja/TODAS.

Las primeras ejecuciones fallidas del verificador eran problemas de preparación de la línea base TypeScript; los logs se conservan. El estado terminal posterior es PASS y la fijación de revisión/transpilación también se verificó sin volver a consultar la base.

## Límites

- No se crearon usuarios, sesiones, clientes, entradas ni movimientos reales.
- Las pruebas de navegador interceptan todas las solicitudes API; no verifican una sesión, permisos reales ni una descarga autenticada.
- La vista previa real mostró login sin sesión disponible. No se intentó iniciar sesión ni se presenta esa pantalla como aprobación funcional de Cartera.
- La activación corresponde al entorno de desarrollo; no se publicó una nueva versión.
- Los demás endpoints siguen pendientes, sin corregir: `pendientes.md` y el Bloque 3 de `replit.md`.