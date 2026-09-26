# Verificación enfocada del candidato: APROBADA

Se abrió el componente real **`/inventario`**, no la revisión de entrada ni un componente simulado. Índice servido SHA256 `09e9fb57f7fc495b98107b86d796e5cbce980aa5755a62a6bb47a87bd98ad9c9`, candidato `dist-noche-task7-inventory-20260926`; API original `e62a79333d0ee1433c114656af980e33ff420b728688a121ee586efdfab1b30d`.

- Tabla agrupada filtrada por `NOCHE26 UNIDADES`: columnas independientes **Kg. 13.00**, **Bolsas 19.00**, **Pzas. 17.00**, tanto en renglones como en pie de totales. PIEZA ya no desaparece ni se suma a metros/kilos/bolsas.
- METRO de entrada5 usa producto previo con más inventario; no se afirmó que el total agrupado del producto fuera11. Se comprobó **rollo10000033, 11.00**, en la pestaña real Detalle de Rollos. La entrada5 se leyó independientemente.
- Capturas: `actual-inventory-separated-piece-kilo-bolsa.png` y `actual-inventory-entry5-metro11.png`. SHA256 y assertions en `result.json`.

La primera ejecución, conservada en `../inventory-piece-candidate`, tuvo dos errores del harness: selector ARIA para encabezado y asumir tabla donde el detalle usa tarjetas. Sus capturas ya mostraban contenido correcto. Se corrigieron exclusivamente los selectores del harness y se completó la comprobación enfocada; ningún recorrido monetario completo se repitió.

El manifiesto antiguo de navegador apuntaba todavía al frontend original. Se conservó intacto; el harness del candidato selecciona explícitamente la ruta autorizada por MAIN y compara su hash con el índice realmente servido.