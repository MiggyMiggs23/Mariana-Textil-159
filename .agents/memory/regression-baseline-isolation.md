---
name: Aislamiento de versiones para regresiones
description: Cómo comprobar que una prueba falla contra código anterior sin alterar la app en ejecución.
---

Las comprobaciones contra una versión anterior deben ejecutarse desde una copia temporal o mediante una sustitución del módulo exclusiva del proceso de prueba. No sustituir archivos de la aplicación vigilados por workflows, ni siquiera para restaurarlos después.

**Why:** Los workflows recargan los cambios automáticamente; sustituir temporalmente una consulta puede exponer el comportamiento anterior a usuarios activos durante la prueba, aunque la base de pruebas esté aislada.

**How to apply:** Mantener separados tanto los datos como el código de la línea base. Comparar los resultados rojo/verde sin alterar los módulos que sirve la aplicación.

Para fechar un fallo, comparar el contrato y la implementación de la misma
revisión, no aplicar retroactivamente la expectativa actual a código antiguo.

**Why:** La existencia del archivo no demuestra que ya existieran su nombre,
su aserción o sus datos esperados. Usar las etiquetas actuales contra una
versión anterior puede inventar una fecha de primer fallo.

**How to apply:** Recorrer la ascendencia, comprobar que la aserción y sus
entradas existían, y contrastar el predicado con el padre. Distinguir el cambio
causal verificable del primer registro de ejecución fallida; si no hay prueba
de continuidad, no afirmar que llevaba fallando ininterrumpidamente.

También hay que aislar las dependencias internas del workspace. Compartir un
`node_modules` completo mediante un enlace puede hacer que el código de la
referencia importe paquetes internos de la copia que se está modificando.

**Why:** Una comparación aislada llegó a cargar contratos generados nuevos
durante la ejecución de la referencia, produciendo fallos que no pertenecían
al código de referencia.

**How to apply:** Se pueden compartir dependencias externas inmutables, pero
los enlaces a paquetes internos deben apuntar a los paquetes de la misma copia
aislada. Comprobar las rutas de resolución antes de atribuir un rojo al commit.

Los controles negativos que alteran bytes necesitan copias físicas de los
archivos modificables, no un árbol temporal con symlinks hacia el candidato.

**Why:** Un control de integridad siguió un symlink y alteró el bundle
candidato fuera del sandbox. El runtime activo quedó intacto, pero hubo que
recompilar el candidato y repetir su verificación; la primera evidencia no
acreditaba un control aislado.

**How to apply:** Resolver `realpath` del destino antes de escribir el defecto
y exigir que permanezca dentro del directorio desechable. Compartir solo
dependencias inmutables; copiar físicamente el bundle o manifiesto que se va
a alterar y cotejar después el hash original.