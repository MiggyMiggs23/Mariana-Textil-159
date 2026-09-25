# E7 — texto explicativo y orden del menú

Cambios exclusivos de presentación:
- CAJA: Cortes → Atribución E7 → Alertas, conservando la entrada y sus permisos.
- Explicación literal del propietario debajo del encabezado. Sin el subtítulo técnico anterior.
- No se cambiaron tarjetas, cálculos, consultas, roles ni permisos.

Rótulos existentes que NO coinciden exactamente y permanecen intactos:
- Recepciones físicas comprobadas.
- Aplicaciones comprobables a notas.
- Dinero retenido pendiente de aplicación.

## Construcción y verificación

Para no activar el candidato comercial cerrado del árbol actual, se extrajo
la base de UI servida desde 512c6ff010c136a843b66cd971cfaff1fd7bee0a en
`.local/e7-text-baseline`. Los dos archivos de presentación eran idénticos
en esa base y HEAD antes de editarlos. Solo se copiaron esos dos archivos
modificados a la extracción; dependencias workspace resueltas dentro de ella.

Build Vite PASS. Nuevo frontend: `dist-e7-explanation-20260925`.
El workflow web apunta al nuevo bundle y se reinició; API sin cambios ni
reinicio. No DDL ni escrituras de negocio.

Captura del frontend servido con respuestas sintéticas interceptadas:
`resultado.png`. No utiliza cuentas reales ni refleja cifras del negocio.
Verificación visual PASS: menú en orden solicitado, explicación sin los
términos prohibidos y rótulos conservados. `verificacion.json` conserva el
texto renderizado. La comprobación de preview sin sesión se queda en el
control de acceso; no se abrió la página a visitantes sin autorización.