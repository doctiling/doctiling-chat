# Changelog — @doctiling/chat

Consumers (doctiling-web) pin tags; every entry is a tag.

## 0.3.0 — layout de escritorio a dos columnas desde 768 px; móvil sin cambios

- Desde `md` (≥ 768 px, decidido por tamaño de viewport con `matchMedia`, nunca por user agent): columna
  izquierda de 320 px con la lista de bases (refrescar, ajustes, instalar; base abierta resaltada, navegable
  con teclado) y columna derecha con la conversación de `/kb/:id`, los Ajustes en `/settings` o el estado
  vacío "Elige una base para empezar" en `/` y `/kb`. Rutas y `basePath` sin cambios.
- Conversación en escritorio: contenido centrado a 760 px, composer dentro de la columna, Enter envía y
  Shift+Enter inserta salto de línea. La fuente citada se abre en un panel lateral de 420 px
  (`role="complementary"`) en lugar del bottom sheet.
- Móvil (< 768 px): navegación apilada, composer con safe-area y bottom sheets exactamente como antes; Enter
  inserta salto de línea y solo el botón Enviar envía.
- Nuevo `useMediaQuery` (`src/lib/media.ts`, SSR-safe) y helper de tests `setViewport('mobile'|'desktop')`.

## 0.2.0

- El chat es un paquete React compilado dentro del studio (spec 045, enmienda 2026-10-07).
