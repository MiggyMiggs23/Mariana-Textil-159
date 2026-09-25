# Tarea 2 — apertura autorizada E11; límites vigentes

Fuente normativa posterior: `../autorizacion-propietario.txt` y `../INFORME.md`.
MAIN aplicó a la base efectiva SQL de corrección de aliases, `folioFactura`
como texto y retiro de los ocho cierres documentales E11 en transacción:
`../tarea-1/apply-task2-operator-result.json` confirma `COMMITTED`. No repetir
ese SQL. Fuente API/UI y preparación E5 ContadorA ON en commit
`4287adc2d13754810444f8b4d422f15ec8d20ecf`. A prepara sin aplicar;
ADMIN aplica; F no prepara. CONTADOR sin A expresa resuelve F.

Pool efectivo de aplicación: cero cuentas CONTADOR y cero perfiles al preflight,
sin asignaciones reales posteriores declaradas. Los dos contadores de tarea 6
son **sintéticos en night56_test**, no usuarios de aplicación. La fuente se
ensayó con productores PostgreSQL no vacíos en copia destruida:
`../tarea-1/positive-final-source.log` (factura 15.50, exclusión no facturada,
aceptación y NO_CUADRA con aviso ADMIN). Mutante default A: seis fallos en
62 casos, restauración 62/62 (`default-a-mutant-red-focused.log`,
`default-f-restored-green.log`). Builds API/UI aprobados y candidato servido
por MAIN en `dist-night-task12`, inspection preservado, health 200 observado
2026-09-25T05:09:38Z (véase tarea 1). No afirmar de ello conciliación
autenticada completa en nuevo candidato.

Tarea 6 obtuvo login real y negativas de API autenticada sobre fuente
**congelada anterior**: F vio factura y no facturada quedó 404; A negó fiscal;
ambos denegaron Fondo/pagos proveedor/legacy. Sólo snapshot diario cero tuvo
POST 200; al navegar antes del acuse UI apareció RESULTADO_INCIERTO y se
detuvo sin repetir. Semana, mes, aceptación, NO_CUADRA y aviso ADMIN no
están comprobados en navegador. A no preparó E5 ni ADMIN lo aplicó allí.
No confundir ese resultado parcial con el ensayo positivo de productores ni
con el bundle nuevo. Véase `../tarea-6/final-results.json`.