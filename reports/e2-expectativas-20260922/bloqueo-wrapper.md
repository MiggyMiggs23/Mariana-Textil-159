# Regeneración de expectativas — detenida antes de modificar el paquete

Fecha: 2026-09-22.

La primera escritura fue la autorización literal en
`reports/e2-paquete-liberacion-preparado-20260921/autorizacion-regenerar-expectativas-b0-b1.txt`.

## Impedimento encontrado por lectura estática

La autorización permite actualizar `release-expected.json`, el manifiesto y
`package-integrity.sha256`, pero prohíbe cambiar el wrapper.

La cadena vigente es:

1. `release-assets.sha256`, renglón 15, fija el SHA-256 de
   `release-expected.json`:
   `990c85fdd6251d6d0f55b62bb0f9a2b4afb3c3fe35468dc12ea6ec8708077ca6`.
2. `api-start-audit.sh`, renglón 14, fija literalmente el SHA-256 de
   `release-assets.sha256`:
   `2f62ecdcd6e2127f8724e42fbb0a1e81205479219ed1ccd69eef7dc5f1798be1`.
3. El wrapper verifica primero ese hash literal y después ejecuta
   `sha256sum --check --status` sobre el inventario. Solo entonces invoca
   el preflight.

Actualizar solo las expectativas deja inválido el inventario de assets.
Actualizar también ese inventario deja inválida la comparación literal del
wrapper. Actualizar `manifest-final.json`, su sidecar y
`package-integrity.sha256` no elimina ninguna de esas dos verificaciones.

Por tanto, no se puede entregar un paquete coherente y un texto de fase B
ejecutable manteniendo el wrapper byte a byte intacto.

Esto es un conflicto de alcance de la autorización, **no una diferencia nueva
observada en la base real**. No se realizó una nueva consulta del catálogo.

## Estado conservado

- No se modificaron expectativas, manifiestos, inventarios de integridad,
  wrapper, lógica de preflight, SQL ni bundles.
- No se accedió a la base real, no se aplicó SQL, no se reinició la API y no
  se modificó el workflow.
- No se creó base desechable; no hay una base temporal que destruir.
- No se validaron nuevas expectativas ni se emitió un texto de fase B como
  si estuviera listo.

Para continuar se necesita autorización adicional para actualizar el renglón
de `release-expected.json` en `release-assets.sha256` y únicamente el hash
literal de ese inventario en `api-start-audit.sh`, sin cambiar su lógica ni
sus controles. Los hashes derivados de ambos tendrían que propagarse al
manifiesto, su sidecar, el inventario del paquete y el nuevo texto de fase B.
No se hizo ninguna de esas modificaciones.