# Menú lateral desplazable

Versión activa: `dist-test-reset-scroll-20260925`, construida sobre la fuente
aislada previamente aprobada. Solo cambió la ubicación del botón en AppLayout:
dentro de la navegación desplazable de escritorio y móvil, después del contenido.
No se modificó ni reinició la API; no hubo escrituras en la base de datos.

Verificación en navegador con respuestas API sintéticas y sin peticiones de escritura:

- Escritorio 1280×720: botón fuera de vista al inicio; al final, perfiles A/F
  completamente visible en y=603–639 y área del reinicio en y=655–720.
- Móvil 402×874: perfiles A/F en y=757–793 y botón en y=822–862,
  completamente dentro del menú desplazado hasta el final.
- Cortes completamente visible, sin intersecciones ni elementos superpuestos,
  en ambos tamaños.
- Se conserva la línea roja y el botón rojo.
- Contexto no ADMIN: botón ausente.

Capturas en `artifacts/mariana-textil/reports/test-reset-scroll-20260925/`.
Los valores y el usuario de las capturas son sintéticos; no representan datos reales.