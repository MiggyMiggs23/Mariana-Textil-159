# Tanda C — informe único, tareas 1 a 11

## Resultado ejecutivo

Se atendieron los once puntos en su orden de commits. **No se declara todo
aprobado:** la tarea 7 conserva un bloqueo de fidelidad del ensayo, no un
paquete listo para liberar. La tarea 3 acredita 27/28 suites y excluye únicamente
pagos-dirigidos por la puerta apagada autorizada como exclusión.

Las tareas de diagnóstico, diseño y purga son documentos: no implementan las
propuestas ni ejecutan correcciones financieras, reversos o limpieza.
En T11 se corrigió solamente documentación; los cambios productivos de esta
tanda son exclusivamente T1 y T2 y **no se desplegaron**.

Autorización íntegra: `reports/autorizacion-tanda-c-20260923.txt`, comparada
byte por byte con el adjunto. Fue la primera escritura de la tanda. Las tareas
8–11 completan ese alcance con el mensaje del propietario; su instrucción
posterior de continuar sin decisiones intermedias no se usó para ejecutar
acciones que había pedido solo diagnosticar o documentar.

## Índice de entregas y revisiones exactas

Todos los documentos de esta tabla están en `reports/tanda-c-20260923/`.

| Tarea | Resultado | Documento | Commit exacto |
|---|---|---|---|
| 1 | Corregida en fuente: default BODEGA/contenedores denegado, alineado con pending-costs; documentado en replit y respuestas U | `01-bodega.md` | `d7ba61260d946e8cad586f7f83746e3b14e74a31` |
| 2 | Corregido numFmt monetario de saldo a favor en Excel real | `02-formato-cartera.md` | `1031a630fd461c3df89767bad7a14cc777e56261` |
| 3 | 27/28 calificadas; única exclusión pagos-dirigidos; sin apertura | `03-suites-actor.md` | `ec009f71349eba2dbc540cec7ed49302d81cc5b7` |
| 4 | Diagnóstico con conteos actuales READ ONLY, causas estructurales y tres alternativas; cero correcciones | `04-creditos.md` | `7b8f5e4a2053590206b8e0131ad5649af6065b16` |
| 5 | Tres diseños de etiqueta, medidas, presupuestos de caracteres y límites; sin UI modificada | `05-etiqueta.md` | `d4281663d1da3636434c09d02ed8e8a9d7ab30ca` |
| 6 | 69 referencias únicas agrupadas, alternativas/recomendación y apéndice contra código; sin permisos cambiados por esta tarea | `06-vetos-roles.md` | `acc06f0d78acb3c4e39bc9d18ac5ed2473a4c1b9` |
| 7 | Builds/captura/preflight PASS; ensayo detenido por atributos de enum; paquete NO listo para liberar | `07-paquete-tanda-b.md` | `63033cd30ebe0b610198fb644b73f50024670fcd` |
| 8 | Nueve vías de reverso con ejemplos y regla estricta; nota de décima vía histórica sin productor | `08-reversos.md` | `6c230defc86cda7e7b86f560857004721aabc07f` |
| 9 | Tres diseños de devolución de mercancía, inventario/crédito/caja y preguntas del propietario; sin construir | `09-devolucion-mercancia.md` | `3847a07a78089c9e68209063f9165e18b3554cbb` |
| 10 | Procedimiento futuro de purga según método del 13/09, preservación, orden, respaldo/ensayo, secuencias y recuperación; no ejecutado | `10-procedimiento-purga.md` | `d906f7b122f4fb54384a864772eb0f7c313e465f` |
| 11 | Cinco correcciones documentales evidentes aplicadas; nueve dudas separadas y cobertura de replit completo | `11-auditoria-documental.md` | `b62a84ea8fb2cf1cc91308dcfdd86db3a5d38f1d` |

## Pruebas y límites

### Correcciones y suites

- T1: seis pruebas unitarias sin DB aprobadas.
- T2: cinco pruebas focalizadas aprobadas; el XLSX se genera y reabre para
  comprobar valor numérico y formato de C2/columna 3.
- T3: permisos **29/29**, seguridad **49/49** y las otras 25 suites reejecutadas
  sobre targets desechables después de T1/T2. No se reutilizaron aprobaciones
  antiguas para rellenar la cobertura actual.
- El runner se detuvo ante nombres dinámicos de pos-location pese a 5/5 casos
  nativos; su evidencia UNSAFE se conservó. El auditor existente la calificó
  mediante relectura durable y prueba de procedencia, sin modificar el historial.
  Se continuó únicamente con las 11 rutas restantes.
- Los tres clústeres actor quedaron destruidos. Auditoría final:
  `reports/actor-suites/tanda-c-final-audit.json`.
- El auditor general exige 28 y por ello sigue en `INCOMPLETE_OR_FAIL`; su
  único error es la ausencia de pagos-dirigidos. No equivale a PASS 28/28.

### Diagnóstico financiero actual

Snapshot de la conexión efectiva del PID 191, base `heliumdb`, OID 16384:
**2026-09-23 07:56:25.822688 UTC / 01:56:25.822688 CDMX**.

- 3 aplicaciones por **$18,000.00**.
- **0** aplicaciones ligadas a ventas revertidas.
- **0** ajustes negativos; por tanto, **0** ajustes negativos sin evidencia
  formal bajo el criterio explícito de T4.
- Libro observado: cuatro movimientos, dos ventas y dos abonos.
- El trigger todavía no excluye la venta revertida de su suma de aplicaciones:
  el riesgo estructural existe aunque ese snapshot no contenga casos.
- Los IDs históricos no se identifican solo por número: sus tipos actuales
  difieren del antecedente. No se afirma que esta tanda reparó datos antiguos.
- La tabla E2 existe, pero la consulta complementaria no reconoce sus columnas:
  su conteo se conserva `null`, no se presenta como cero ni como validación E2.

Prueba durable: `04-creditos-live.json`. La transacción verificó READ ONLY,
REPEATABLE READ y terminó con ROLLBACK; PID/bundle iguales antes/después.

### Paquete de Tanda B: bloqueo exacto

Directorio: `reports/tanda-b-off-preparada-20260923/`.
Fuente congelada: commit T2 `1031a630fd461c3df89767bad7a14cc777e56261`;
sin activation.patch y sin incorporar las propuestas posteriores.

- API/UI compiladas en sus directorios finales `dist-tanda-b-off-20260923`.
- 27 declaraciones de gates verificadas OFF.
- Captura READ ONLY y preflight real con token positivo: PASS.
- Catálogo reconstruido: 1,585 filas de esquema iguales.
- De 902 atributos, **seis diferencias de `enumsortorder` en `rol_usuario`**:
  TERMINAL 1.5→2; CAJA 2→3; SUPERVISOR 3→4; BODEGA 4→5; SISTEMAS 5→6;
  CONTADOR 6→7. ADMIN=1 y el orden relativo permanecen iguales.
- Los 42 atributos de triggers representados coinciden. No se atribuye el
  fallo a drift real de la base: la diferencia está en la reconstrucción.
- Rehearsal FAIL antes de arrancar candidato; PostgreSQL detenido con exit 0
  y directorio desechable destruido. No se alteraron las expectativas para
  aceptar la copia. El control E2 tampoco se arrancó sobre una copia infiel.
- Faltan reconstrucción fiel, arranque y control comparativo, invariancia de
  filas/secuencias durante arranque, controles negativos y HTTP OFF.
  No se presentan los controles estructurales sintéticos como esas pruebas.
- Manifiesto final: **BLOCKED_NOT_READY_FOR_RELEASE**.
  Fase B: **BORRADOR-NOEJECUTABLE**, no autorización ni procedimiento aprobado.
- SHA-256 de API candidata:
  `970c806fa3759a9aa72b57648ff6813a81cef64d703e05e26f17407fa6a79190`.
- SHA-256 de manifest final:
  `37ebf5c1e76d2e759100f2eb7294641261bf89c9051211642c7c26056fe7095a`.
- MAIN verificó manifest, inventario integral/sidecar y assets runtime al
  cierre. Los inventarios preliminares y el fallo original siguen conservados.

## Conclusiones para decisión, sin implementación

1. **Reversos:** comparar el triple POST bloquea varios casos posteriores, pero
   no arregla la inversión incompleta de transferencias, la baja en tránsito o
   cancelar una cancelación. Una corrección de diez metros puede ser legítima
   aunque otra venta haya cambiado el remanente: la regla la bloquearía.
   Si posteriores revertidos restablecen exactamente el triple, la regla sí
   permite; no confundirla con “ningún movimiento posterior”.
2. **Mercancía devuelta:** no equivale a cancelar una venta ni a devolver un
   abono. T9 separa retorno íntegro, retorno parcial con identidad derivada y
   custodia/inspección. Cada diseño explicita efectos financieros y preguntas.
3. **Purga:** el método histórico no es un ejecutable listo para el esquema
   actual. Conservar catálogo/configuración/auditoría y clasificar objetos
   nuevos antes de eliminar. No reiniciar indiscriminadamente secuencias.
4. **Vetos:** las 69 son referencias, no 69 prohibiciones independientes;
   las parejas UI/API se deciden juntas. Las invariantes ADMIN y excepciones E1
   no se convierten silenciosamente en permisos generales.
5. **Documentación:** cinco discrepancias claras corregidas; las nueve dudosas
   no se resolvieron inventando políticas ni interpretando fuente como runtime.

## Preservación operativa

No se ejecutaron escrituras/DDL en la base de la API, purgas, reversos,
reembolsos, actores operativos, reinicios, cambios de workflow ni sustitución
del bundle activo. Las lecturas reales fueron explícitas READ ONLY.
Los procesos de pruebas escribieron únicamente en PostgreSQL desechable.

El control final observó PID 191 y el bundle E2 con SHA-256
`008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`;
la salud respondió `{"status":"ok"}`. No se afirma que un GET pruebe ausencia
absoluta de escrituras ajenas ni los bytes cargados en memoria.

**Nada liberado. E3 y Tanda B no se abrieron.** La tarea 7 queda detenida con
evidencia suficiente para retomar su ensayo sin borrar los fallos conservados.