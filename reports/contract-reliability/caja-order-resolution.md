# Cierre del orden de Tiempo real

## Decisión aplicada

El propietario confirmó que el código actual se conserva. La contradicción
era entre dos instrucciones de `replit.md`, no una copia del orden de
Cuentas Destino ni una autorización para colocar cobranza al final.

- **Línea 800:** única declaración canónica del orden de Tiempo real:
  Ventas → Señales operativas → Cobranza → Estado por Tienda.
  Se eliminó la redacción que intercalaba cobranza entre ventas y señales.
- **Línea 1106:** referencia a «Caja en Tiempo Real», sin repetir el orden.
- **Revisión del documento completo:** no se encontró una tercera instrucción
  de orden vertical de esta pantalla. La línea 560 describe Cuentas Destino
  y se conserva intacta. Las referencias contables y las reglas genéricas
  de composición no establecen otro orden.
- **Política de pruebas, desde la línea 1313:** ante una prueba fallida con
  código aparentemente correcto, revisar primero si la regla escrita está
  equivocada o contradice otra instrucción. Resolver el conflicto con el
  propietario y mantener una sola declaración antes de decidir qué corregir.

La razón queda junto a la regla: ventas y señales son las dos filas que se
consultan de un vistazo durante el día; cobranza no debe separarlas.

## Prueba observable

Se reescribió únicamente el caso
`renders principal row and secondary attention row in exact order`.

- Monta `tiempo-real.tsx` real con datos aislados, validados por el esquema
  de respuesta real, incluyendo cantidades y una tienda no vacía.
- Compara los rectángulos completos de bloques y tarjetas en **1280, 390 y
  402 px**, incluyendo dimensiones positivas para evitar aprobar elementos
  sin tamaño.
- Comprueba el orden vertical y el orden interno de las cuatro tarjetas
  de ventas y las cuatro señales.
- Los textos públicos sirven para localizar elementos. El orden se decide
  por sus coordenadas renderizadas, no por encontrar títulos en una cadena,
  por el orden del texto fuente ni por clases CSS.
- La prueba existente de los **seis desgloses**, sin cambios en su archivo,
  vuelve a aprobar: clic y Enter abren el detalle correspondiente y muestran
  sus columnas y datos propios. Evidencia enfocada:
  [desgloses](caja-order-breakdown-positive.txt); también incluidos en la suite final.

No se alteraron los demás casos del archivo.

## Negativo real y restauración

Comando:

```sh
node scripts/src/observable-caja-order-negative.mjs
```

El script copió la aplicación a `/tmp` e intercambió allí las filas completas
de ventas y señales. Ejecutó el corredor canónico sobre esa copia.

**Con defecto: salida 1**, con este fallo semántico en escritorio:

```text
AssertionError [ERR_ASSERTION]:
desktop: principal sales block must precede operational signals block
```

No fue un error de importación, compilación, montaje ni timeout.
Luego restauró **la misma copia, byte por byte** y obtuvo **salida 0**, con la
prueba completa aprobada en los tres tamaños. El fallo intencional se detecta
en el primer tamaño; no se afirma haber ejecutado tres negativos separados.

Evidencia: [resumen](caja-order-negative-summary.json),
[rojo](caja-order-negative-red.txt),
[restaurado](caja-order-negative-restored.txt).

## Verificación final

| Comprobación | Resultado |
|---|---|
| Suite canónica, 99 archivos | **354 aprobadas, 0 fallidas** |
| Pruebas omitidas / canceladas / pendientes | **0 / 0 / 0** |
| Salida de la suite | **0** |
| Typecheck completo de bibliotecas, API, frontend, sandbox y scripts | **0 errores, salida 0** |
| Fallos de proceso o parser del typecheck | **0** |

Logs: [suite final](after-order-resolution.txt),
[typecheck final](typecheck-order-final.txt).

Se comprobó que la página, su CSS, el archivo de prueba de los seis desgloses,
API, bibliotecas y lockfile no cambiaron. Cuentas Destino y Prompt P conservan
sus secciones completas. No se crearon usuarios ni sesiones, no se escribieron
datos en una base y no se reiniciaron servicios.

La vista previa real mostró correctamente la pantalla de acceso sin iniciar
sesión; no se presenta esa captura como verificación autenticada de Caja.