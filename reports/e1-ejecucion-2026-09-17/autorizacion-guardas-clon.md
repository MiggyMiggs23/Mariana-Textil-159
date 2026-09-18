# Autorización de preparación y ensayo de guardas SQL — sólo clon

Registrada antes de ejecutar la instalación o las pruebas de las guardas.

## Instrucción del propietario

> Prepara y comprueba las guardas SQL en el clon. El riesgo inmediato es bajo —solo tú y yo escribimos directo en la base, con autorización— pero esas tres capturas están deshabilitadas porque E2, E3 y E5 no existen todavía. Sin guarda en base, algo podría escribir un cobro retenido que ninguna pantalla puede ver, aplicar ni conciliar.
>
> Preséntame el SQL y su ensayo en el clon. Esa parte queda autorizada con la misma autorización del clon. Aplicarlo a la operativa no: preséntamelo con su medición y espero para autorizarlo aparte, igual que la migración.
>
> Dos condiciones para ese SQL:
>
> 1. Las guardas deben poder quitarse limpiamente cuando E2, E3 y E5 las habiliten. Dime cómo se quitará cada una, porque una guarda que no se puede retirar se vuelve un problema en tres semanas.
> 2. Que rechacen, no que corrijan en silencio. Un intento bloqueado debe fallar con mensaje, no quedar guardado de otra forma.

## Límites

- Se permite instalar, probar, retirar individualmente y reinstalar las tres guardas **sólo en el clon existente** `restore_disposable_20260917165108-3655`.
- Ninguna escritura ni migración en la base operativa. La API sigue pausada.
- Se medirán instalación y retirada, y se presentarán SQL y resultados para que el propietario evalúe por separado una eventual aplicación operativa.
- No se habilita E2, E3, E5 ni atribución histórica. Retirar temporalmente una guarda durante el ensayo únicamente permite sondas sintéticas con rollback en el clon.
- No se transformarán silenciosamente los intentos bloqueados ni se debilitarán las restricciones permanentes. El estado final del clon conservará las tres guardas instaladas.