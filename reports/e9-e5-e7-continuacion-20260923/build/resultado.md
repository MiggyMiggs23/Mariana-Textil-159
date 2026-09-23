# Candidato offline E9 + E7 — 2026-09-23

## Resultado

**BUILD PASS.** Se construyeron una vez la API y la UI desde la fuente
congelada en:

- `artifacts/api-server/dist-e9-e7-20260923/index.mjs`
- `artifacts/mariana-textil/dist-e9-e7-20260923/index.html`

El bundle contiene E9 documental y E7 lectura/atribución habilitados. El ingreso
E9 al Fondo, las operaciones E5, ContadorA-E5 y la preparación E11-E5 siguen
apagados. Los bundles anteriores se conservaron.

## Puertas comprobadas

- E9 API/UI: ON.
- Ingreso E9 al Fondo: OFF.
- E7 lectores API/UI y atribución: ON.
- Fuente de lectura E5 para E7: ON; no es un productor.
- E5 operativo y ContadorA-E5: OFF.
- E11 lectores, perfiles y conciliación: ON; preparación E5: OFF.

La evidencia línea por línea y la ausencia inicial de ambos destinos están en
`build-gates.log`.

## Comandos

```sh
API_BUILD_OUTPUT_DIR="$PWD/artifacts/api-server/dist-e9-e7-20260923" NODE_ENV=production node artifacts/api-server/build.mjs
(cd artifacts/mariana-textil && BASE_PATH=/ NODE_ENV=production PORT=20329 pnpm exec vite build --outDir dist-e9-e7-20260923)
```

Ambos terminaron con exit code 0. El inventario de fuentes antes y después fue
idéntico, por lo que ningún cambio concurrente entró a mitad del build.
Resultado: 12 archivos API, 11 UI y 23 hashes en
`build-bundles.sha256`. No se repitieron typechecks ya acreditados.

## UI enfocada

E9 montó componentes reales en copias físicas aisladas. Seis obligaciones
pasaron verde, mutante semántico rojo y restaurado:

- no exponer Fondo;
- motivo obligatorio ante diferencia;
- autorización ligada al conteo físico;
- motivo también para sobrante;
- invalidación E9/cortes sin Fondo;
- respuesta final que impide volver a contar o autorizar.

Manifiesto: `ui-evidence/e9-focused-manifest.json`
(`PASS_SELECTED_CASES`).

En E7 pasaron con el mismo patrón ocho obligaciones montadas:

- aplicaciones no duplican cobranza;
- el detalle por sitio no convierte recepciones en movimientos locales;
- rango máximo de fechas;
- consulta con alcance de sitio;
- montaje desde Cuentas Destino;
- leyendas global/sitio y tratamiento de retenidos;
- veto independiente a CONTADOR aunque tenga permiso financiero legado;
- cierre del lector cuando la disponibilidad E7 lo deshabilita.

Los dos controles verdes inicialmente fallidos eran pruebas obsoletas, no
fallos funcionales:

1. `E7-COUNTER-BOUNDARY` montaba el detalle de cliente en la pestaña `datos`,
   donde ya no existe el lector E7, y además envolvía el montaje directo con la
   frontera E11 que desvía correctamente a CONTADOR. Se cambió únicamente el
   arnés para montar el padre real en `?tab=estado`, sin la frontera superior
   ya acreditada. El veto propio de `E7ClientExport` sigue siendo real.
2. `E7-AVAILABILITY` esperaba el literal antiguo `E7 está cerrado.`. El producto
   ahora muestra el mensaje más explícito `Esta lectura E7 está cerrada. No se
   usa una fuente alternativa.`; se actualizó solamente esa expectativa.

La reconfirmación enfocada ejecutó exclusivamente ambos IDs y terminó
`PASS_SELECTED_ONLY_NOT_FULL_E7`: verde, mutante semántico rojo y restaurado
para cada uno. El mutante de CONTADOR abre indebidamente el lector; el mutante
de disponibilidad omite el cierre. Ambos fueron detectados. Manifiesto:
`ui-evidence/e7-counter-availability-reconfirm-manifest.json`.

No cambió código productivo, por lo que no se reconstruyó el bundle. Todos sus
23 hashes se reconfirmaron byte por byte en
`bundle-recheck-after-e7-test-fix.log`. No hubo escrituras financieras desde
navegador.

## Logs y límites

- `build-api.log`, `build-ui.log`: builds exit 0.
- `build-status.txt`: códigos finales.
- `build-inputs-before.sha256` y `build-inputs-after.sha256`: fuente congelada.
- `build-output.log`: entradas, conteos y preservación de bundles.
- `ui-evidence/`: evidencia UI enfocada, diagnóstico histórico y
  reconfirmación verde/rojo/restaurado de los dos controles corregidos.

Vite emitió cinco avisos no fatales de sourcemap y uno por un chunk mayor a
500 kB. El bundle API informó su archivo principal de 9.0 MB. No se tocaron
base de datos, workflows, TOML, secretos ni código fuente en este trabajo.