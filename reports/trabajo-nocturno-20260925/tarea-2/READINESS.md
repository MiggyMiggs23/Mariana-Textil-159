# Tarea 2 — candidato positivo; SQL revisable y servicio pendientes de MAIN

## Actualización final — 2026-09-25

Fuente E11 prep y E5 ContadorA frontend/backend ON; A sólo prepara, ADMIN aplica.
F sigue siendo default canónico, sin migración ni asignación ficticia requerida:
pool efectivo de la API confirma cero CONTADOR y cero perfiles.

Ensayo en clúster propio destruido (`../tarea-1/positive-final-source.log`):
ADMIN canónico asigna A a uno de dos CONTADOR sintéticos autorizados; el otro
resuelve F sin fila de perfil. A prepara propuesta real sin efecto contable;
ADMIN la completa, F no prepara y A no autoriza. Factura sintética de 15.50,
notas no facturadas excluidas; snapshots no vacíos día/semana/mes,
aceptación exacta y NO_CUADRA con una notificación ADMIN atómica. Fuente fiscal
sin saldo, límite, teléfono ni correo. 122/122 pruebas E5/E11 en fuente actual.

### Dos fallos SQL reales encontrados al pasar de tablas vacías a productores

1. `00-graph-correction-candidate.sql`: aliases `e/s/d/p` colisionaban con
   variables record incluso después del arreglo histórico `a→aviso`.
   Sólo renombra aliases, sin relajar `variable_conflict`, roles ni invariantes.
   Preflight MD5 actual `39dc276e7192e01691011f271882c09b`.
2. `00b-fiscal-folio-correction-candidate.sql`: SQL `e11_fuente` generaba
   `folioFactura` numérico, pero DTO/repositorio lo emiten string. Todo snapshot
   no vacío fallaba la comparación de fuente. Sólo añade `t.folio::text`,
   manteniendo filtros, importes y fechas. MD5 fuente actual
   `1bc4ce76198842b37802ab29a8a4d013`. Este caso no se detecta con períodos vacíos.

Orden MAIN: ambas correcciones, luego `01-candidate-not-approved.sql`, en una
transacción. El operador de tarea 1 incluye ese orden en `apply-task2`.
**Ninguna se aplicó a appDB.** En night56_test sólo se aplicó el arreglo de
aliases; permanecen sus nueve cierres E5 y ocho E11. La corrección de folio
todavía no se aplicó allí, porque el browser no pidió conciliación aún.

Commits separados por MAIN: tarea 1 tiene su parche exacto sin habilitar A.
Tarea 2: `e11-feature.ts`, `e11.test.ts`, `e11-tanda-d.test.ts`, UI
`e11-feature-flags.ts`, más el hunk `E5_CONTADOR_A_ENABLED=true` de
`e5-feature.ts`. El parche de los cuatro primeros está preparado.

Builds API/UI candidatos PASS, pero MAIN debe servirlos contra disposable,
verificar health200 y browser antes de liberar la aplicación. Capturas de tarea
1 son sólo fixture React, no prueba de login/API. No hay commit de este trabajador.

## Registro anterior (preservado; la actualización anterior sustituye pendientes resueltos)

La fuente ya tiene lectores, selector ADMIN y conciliación E11 ON, pero los
ocho cierres SQL están activos en heliumdb. El preflight de tarea 1 acredita
cero cuentas CONTADOR y cero perfiles. El resolvedor canónico ya devuelve F
para CONTADOR sin A explícita: no hace falta insertar perfiles ficticios ni
actualizar usuarios. No se asignó A a nadie.

`01-candidate-not-approved.sql` retira sólo los ocho cierres de las tablas
documentales E11, preservando guardas de autorización, identidad, grafo e
inmutabilidad. No reinstala el DDL base ni concede permisos genéricos. MAIN
debe revisar alcance/identidad antes de cualquier aplicación.

## Ensayos

- E11 y contrato Tanda D: 71/71 unitarias (sin conexión a BD).
- Mutante aislado que resuelve el CONTADOR por defecto como A: seis fallos
  en 62 casos; restauración 62/62. El intento combinado inicial tenía además
  un fallo de arnés al no copiar los archivos UI; no se cuenta como evidencia
  roja. La evidencia válida es `default-a-mutant-red-focused.log`.
- PostgreSQL nuevo: instalación de esquema vacío, ensayo de candidato E5 y
  E11; cero perfiles, cero usuarios, cierres de refund conservados, destrucción
  completa confirmada. **No acredita conciliación real ni flujo ContadorA.**
- La primera reconstrucción E11 falló por su hash histórico de la función
  E5. No se relajó esa comprobación: se recuperó en lectura la definición
  original que el propio sidecar había conservado, se reprodujo esa base
  histórica en disposable, se instaló E11 allí y después se restauró la
  función actual para ensayar los candidatos. La app no se modificó.
- Los hashes de fuente leída están en `source.sha256`; la base Git de esta
  tanda es la de `../tarea-1/base-commit.txt`.

## Pendientes imprescindibles

Preparación ContadorA/E5 sigue OFF; no se cambiaron esos flags sin completar
el ciclo de tarea 1. Quedan ensayo PostgreSQL positivo con repositorio real,
capturas disposable, sesión auténtica y API para F/A, todas las exclusiones
fiscales/sensibles, conciliación día/semana/mes y aviso ADMIN de no-cuadra.
Los casos unitarios existentes verifican esas decisiones en modelo/SQL
capturado, no sustituyen los recorridos reales. MAIN controla arranque,
healthz, aplicación autorizada y liberación. No se hizo commit propio.