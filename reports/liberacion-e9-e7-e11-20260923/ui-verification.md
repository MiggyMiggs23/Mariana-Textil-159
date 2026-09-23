# Verificación enfocada de UI E9/E7

## Resultado

**PASS enfocado.** No se ejecutaron workflows, navegador autenticado, usuarios,
sesiones ni escrituras en base de datos.

La verificación se hizo en una copia física aislada del árbol para que cambios
concurrentes ajenos no alteraran la fotografía de fuente. Los manifiestos
finales registran cero cambios durante cada corrida.

## E9

Tres obligaciones críticas de la separación del Fondo pasaron en componente
montado, con verde, mutante semántico rojo y fuente restaurada:

- ningún actor puede ver un identificador o enlace Fondo conservado en caché;
- autorizar documentalmente invalida E9/cortes, pero no Fondo;
- la respuesta autorizada se muestra como documental, conserva la
  investigación y no vuelve a habilitar conteo/autorización.

Resultado: `PASS_SELECTED_CASES`. Evidencia:
`ui-evidence/e9-focused/manifest.json`.

Esta corrida es enfocada y no se presenta como la suite UI E9 completa. La
fuente E9 todavía requiere que MAIN aplique primero el SQL mínimo preparado que
desacopla el trigger de Fondo; esta prueba UI no acredita esa operación.

## E7

Tres obligaciones del lector financiero de cliente pasaron en componentes
reales montados, cada una con verde, mutante semántico rojo y restauración:

- exactamente cuatro cifras globales y sin consulta paralela al estado de
  cuenta legado;
- enlaces PDF, XLSX e impresión conservan el sitio autorizado;
- una respuesta de otro cliente se bloquea y no expone acciones.

Resultado: `PASS_SELECTED_ONLY_NOT_FULL_E7`. Evidencia:
`ui-evidence/e7-client-reads-focused/manifest.json`.

La modalidad enfocada no acredita nuevamente los bytes binarios históricos de
PDF/XLSX; acredita la UI, el contexto de sus enlaces y el consumo del JSON.
El contrato estático adicional pasó 2/2 y el typecheck UI pasó. Evidencia:
`ui-release-contract.log`, `ui-typecheck.log` y `ui-command-status.txt`.

## Correcciones realizadas durante la verificación

- El estado de cuenta E7 dejó de lanzar en paralelo el lector legado cuando
  está activo el lector E7.
- El texto de E7 ya describe el estado de cuenta financiero vigente, en vez de
  presentarlo como una vista previa que no sustituía la pantalla.
- Los casos montados navegan explícitamente a la pestaña Estado de cuenta.
- Los mutantes E9 ahora comprueban el límite vigente: ninguna exposición ni
  invalidación de Fondo.

Un primer intento E7 fue rechazado por la huella histórica de documentos, no
declarado PASS. Se añadió una modalidad enfocada que excluye expresamente esa
prueba binaria no relacionada. Después se encontró y corrigió la navegación
antigua del caso de enlaces; solo la corrida final verde/rojo/restaurada se
reporta como PASS.