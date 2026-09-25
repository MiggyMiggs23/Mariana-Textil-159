# Tarea 1 — apertura autorizada E5; límites vigentes

Fuente normativa posterior: `../autorizacion-propietario.txt` y `../INFORME.md`.
MAIN aplicó el SQL revisado a la base efectiva de la aplicación con resultado
`COMMITTED` (`apply-task1-operator-result.json`), y comprometió fuente en
`c0865b96ae6198dd9aec13a9ac43c37fae825717`. La apertura E5 dirigida y
retenida está ON en API/UI; devolución `E5_REFUND_ENABLED=false`, guardas SQL
de devolución y salida bancaria conservadas. No se abrió Fondo, E12 ni atribución
histórica. La preparación A compartida se abrió posteriormente con tarea 2.

El ensayo positivo PostgreSQL de `positive-final-source.log` realizó recepción,
rechazo, repropuesta, aplicación parcial, preparación A y aplicación final ADMIN
en copia desechable destruida; devolución y cambio de destino rechazados.
122/122 pruebas E5/E11, 6/6 contratos dirigidos y mutante refund ON rojo
(3 fallos/51, restaurado 51/51) corresponden a esa fuente candidata, no
demuestran el recorrido E5 autenticado del bundle nuevo. `fixture-before.png`
y `fixture-after.png` son React aislado, no capturas de login.
Builds API/UI candidatos pasaron; MAIN activó `dist-night-task12` con API PID
39225 y web PID 39258, inspection preservado y health HTTP 200 observado
2026-09-25T05:09:38Z; API SHA-256
`a20509b6a2b050262a50dc3852f9a76f94aac8726f6ee16efad594e4be23b206`.
El navegador de tarea 5 usó fuente congelada previa, dejó sus nueve cierres E5
y **no** acreditó un E2E autenticado de este nuevo candidato. Tampoco se
acredita la suite HTTP legacy `pagos-dirigidos.integration.test.ts`.
No repetir SQL ya aplicado ni usar el texto de preparación anterior como
estado actual. El detalle de commits, pruebas y límites está en `../INFORME.md`.