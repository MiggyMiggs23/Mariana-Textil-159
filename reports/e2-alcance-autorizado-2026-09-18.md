# E2 — autorización de preparación, no de escrituras en base

## Instrucción textual del propietario

> Prepara E2 completo y deja la devolución construida pero inactiva. Buen hallazgo el del bloqueo: la contradicción es mía — te pedí construir la devolución y a la vez no retirar la guarda que la bloquea. No la elimines ni la eludas.

## Alcance

- Preparar la implementación completa de E2.
- Construir el flujo de devolución con validaciones, interfaz y evidencia, pero mantenerlo inactivo.
- No eliminar, modificar para abrir ni eludir las tres guardas de E1.
- No habilitar recepción de efectivo de crédito, cobros retenidos ni atribuciones históricas.
- La construcción inactiva no acredita una devolución operativa ni autoriza retirar sus bloqueos.
- Permanecen las restricciones del documento E2, incluida la conservación exacta de cortes cerrados y la prohibición de crear usuarios o sesiones de prueba.

## Límite de esta autorización

Este texto no autoriza ninguna escritura en una base: ni operativa, ni clon conservado, ni base de ensayo. Cualquier DDL/DML, ensayo que escriba, restauración o arranque con inicializadores que escriben requerirá alcance presentado y autorización textual adicional previa, guardada en `reports/`.

El servidor API actual usa un bundle construido, sin watcher. Se puede preparar código sin reiniciarlo; no se reiniciará contra la base sin cubrir antes las escrituras de sus inicializadores.