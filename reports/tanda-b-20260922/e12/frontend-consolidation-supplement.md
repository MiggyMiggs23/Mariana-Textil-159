# E12 — suplemento de consolidación de evidencia frontend

## Resultado consolidado, no relabel de tandas

Se verificaron **33 obligaciones E12 con GREEN → RED semántico → GREEN
restaurado**, y **15 regresiones E4 existentes GREEN-only**: 114 ejecuciones
terminales aceptadas, sin duplicar IDs. Es evidencia compuesta de tres tandas,
no un único runner terminado ni un PASS homogéneo bajo un único harness.

| Directorio `frontend-node-mutants-2026-09-22T…` | Estado original intacto | Aporte aceptado |
|---|---|---|
| `19-51-29.604Z` | `FAIL_NOT_ACCEPTED` | Primeros 7 ciclos E12 completos |
| `19-56-12.418Z` | `PREPARED_NOT_EXECUTED`, sin `finishedAt` | Otros 26 ciclos E12 y primeros 7 GREEN E4 |
| `20-01-38.538Z` | `PASS_SELECTED_CASES` | Últimos 8 GREEN E4 |

La primera tentativa de `E12-PAY-RETRY` no se cuenta: su GREEN falló.
La tentativa interrumpida de `E4-CAPTURE-DOUBLE` tampoco se cuenta.
Sus ejecuciones terminales válidas pertenecen a las tandas posteriores.
El inventario exacto por ID se reproduce mediante el auditor adjunto.

## Verificación independiente posterior, sólo lectura

Se ejecutó únicamente:

`node reports/tanda-b-20260922/e12/audit-frontend-consolidation.mjs`

No ejecuta pruebas, builds, aplicaciones, API ni SQL; no reescribe evidencia.
Contrasta cada fase aceptada contra el reporte JSON nativo original:
exactamente un test ejecutado, ID correcto, resultado terminal y exit code.
Los **33 negativos** tienen `ERR_ASSERTION` propio con su marcador exacto
(incluido el wrapper nativo `ERR_TEST_FAILURE/testCodeFailure` cuando aplica),
no fallos de setup, resolución de módulos o aislamiento.
Comprueba terminal de build y ausencia de marcadores de infraestructura.

Verifica además:

- Hash original productivo, hash del mutante reconstruido desde el anchor único
  y hash de restauración; fuentes físicas green/restored y bundles conservados.
- Tests, harness de hooks, guard, DOM, reporter, build y flags físicos de cada
  snapshot aceptado contra sus hashes iniciales.
- **Todos los 1.234 `sourceHashes` de cada manifest contra el árbol actual**:
  3.702 comparaciones, no sólo los archivos mutados.
- Los nueve `harnessHashes` de cada tanda: 27 comparaciones, sin diferencias.

Resultado del auditor: **cero errores**. Las tandas segunda y tercera coinciden
íntegramente con las fuentes actuales. En la primera hay exactamente una
diferencia declarada, exclusivamente de infraestructura de prueba:

`artifacts/mariana-textil/src/components/e12-node-test-harness.tsx`

- Primera tanda: `9c40ce32572e63a6539b7aebe4a2bf15e0a328b14cd6cbd4ded9b474269f902c`
- Actual / tandas siguientes: `10d2948c08d5ad5fb92a0893f34c0b9956b720de89d175c216f3cb39bf5b621d`

No hay diferencias productivas ni de contratos compartidos dentro de los
mapas auditados. Los mapas frontend no equivalen a una auditoría del backend.
E4 histórico, su suite/harness nativos y sus reportes no difieren del commit
`95aa2bcc89fd5f7d6a5ea142ba6c9d403ac18000` en la comparación realizada.

### Integridad de los manifests preservados

| Tanda | SHA-256 original |
|---|---|
| 19:51 | `9b15b3fd4e78a8f0466d16e3be4e808f9c4d71df3d5edd26d32885e9b2ccb5b6` |
| 19:56 | `d8f3275d53354153d46a969acc63445dabfdda7cf651cdce0bd713f4c9324a4e` |
| 20:01 | `3a14365dfa3a21faa4a131f434a57977995258668c9c4450386e94643da2b46f` |

## Incidentes y límites

1. La entrega UI inicial aún tenía conexiones funcionales incompletas.
   La reparación posterior descrita en `frontend-functional-completion.md`
   incorporó productores reales, fuentes, reversión, evidencia e invalidaciones.
   Fue revisada estáticamente antes de estas ejecuciones. No se atribuye el
   resultado completo al primer diseñador ni se presenta aquella entrega
   incompleta como funcionalmente aprobada.
2. El primer typecheck detectó seis opciones `exact:true` inválidas en
   `getByRole`. Se retiraron sin cambiar los nombres string exactos.
3. El fallo de retry fue del harness: invocaba correctamente `onSettled`, pero
   omitía la notificación posterior del `MutationObserver` al suscriptor React.
   El ref productivo se liberaba, pero el DOM permanecía disabled. `useToast`
   delega a Sonner sin suscripción local. Se corrigió sólo esa notificación,
   siguiendo query-core 5.101.4; no se relajó el escenario ni se cambió producción.
   Los siete ciclos anteriores conservan su evidencia y su hash de harness
   anterior; no se afirma que fueran reejecutados con el nuevo.
4. MAIN informó que el timeout **externo** de ShellExec a 300 s terminó el
   runner de 19:56 y confirmó que no quedó vivo. No fue un RED semántico.
   Ese manifest conserva su estado inicial y carece de `finally`/`finishedAt`.
   Esta auditoría posterior verifica ahora todas sus fuentes contra el inicio;
   no falsifica el `finally` ausente ni demuestra retrospectivamente ausencia
   de escrituras transitorias revertidas. Las fases ya terminales son verificables;
   la tentativa incompleta no se acredita.

MAIN informó typecheck frontend PASS en
`frontend-types-20260922T195035Z.log` y, después de corregir el harness, en
`frontend-types-20260922T195540Z.log`.
También informó backend 40/40 GREEN/RED PASS en
`logs/backend-2026-09-22T19-31-54.810Z` y typecheck API PASS.
Este suplemento no reejecuta ni certifica independientemente esos resultados
backend; mantiene separados sus alcances.

La cobertura frontend no prueba SQL real, autorización de servidor,
concurrencia transaccional, idempotencia de DB ni inmutabilidad histórica de
cortes reales. Las observaciones enabled/refetch no son conteos HTTP reales.
No se liberaron gates ni se hicieron cambios runtime en esta consolidación.

## Pathspec para MAIN

`frontend-pathspec.txt` contiene únicamente las 13 fuentes frontend
productivas/de prueba pertinentes y todo `reports/tanda-b-20260922/e12`.
Excluye `.agents`, helpers temporales raíz, fuentes backend y contratos
generados compartidos, que MAIN puede agrupar por separado.
No se ejecutó staging ni commit.