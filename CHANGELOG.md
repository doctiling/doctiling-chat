# Changelog — @doctiling/chat

Consumers (doctiling-web) pin tags; every entry is a tag.

## 0.5.0 — compartir, agrupar por acceso y cabecera de la lista sin truncar

- **Compartir** (cabecera de la conversación, icono `Share2`): abre la hoja de compartir del sistema con el
  nombre de la base y la URL de su conversación (`navigator.share`); sin ella copia el enlace y avisa
  ("solo quien tenga acceso podrá abrirlo"). Cerrar la hoja no avisa de nada; si tampoco hay portapapeles,
  error traducido. El enlace no concede nada: el servidor sigue decidiendo el acceso (`src/lib/share.ts`).
- **Agrupar por acceso** (cabecera de la lista, icono `Layers`, `aria-pressed`): secciones "Gestionas"
  (owner/admin), "Colaboras" y "Solo lectura", con recuento y encabezado fijo; los grupos vacíos no se
  pintan y la insignia de rol se omite dentro de un grupo. Preferencia local `groupBy` (`src/lib/storage.ts`).
- **Cabecera de la lista**: el título "Bases de conocimiento" ya no se trunca en la columna de 320 px;
  pasa a dos líneas (`text-balance`) y los botones quedan arriba a la derecha.
- Tests: `tests/screens/Conversation.share.test.tsx`, agrupación y título en `KnowledgeBases.test.tsx`.

## 0.4.0 — lista de documentos, menciones `@` y permisos visibles

- **Documentos de la base** (`GET …/knowledge-bases/{kbId}/documents`, solo lo que la persona puede leer):
  nueva pantalla `src/screens/Documents.tsx` con icono por tipo, insignia "Privado" en los propios privados,
  aviso "Sin indexar" cuando `indexed=false`, caja de filtro (sin distinguir mayúsculas ni acentos) y
  apertura del documento en lectura al tocar (`/kb/:id/doc/:docId`). Móvil: ruta `/kb/:id/docs` desde el
  icono "Documentos" de la cabecera. Escritorio: el mismo icono alterna la lista en el panel lateral, en el
  lugar de la fuente; las dos columnas no cambian. La lista se pide una vez por base y se guarda en memoria
  (`src/lib/documents.tsx`, dentro de `ChatProvider`) para el selector de menciones.
- **Menciones `@`** en el composer: `@` abre un selector (listbox) filtrado por el texto tras la `@`,
  ↑↓/Enter/Esc en escritorio, toque en móvil; elegir inserta un chip `@Título` sobre la caja y quita el
  `@…` del texto; los chips se quitan con un toque; el envío pasa `{ query, referencedDocumentIds }`
  (`turn.content` sigue siendo solo la pregunta) y los chips se vacían. La pregunta muestra las
  referencias como etiquetas. Máximo 10; la undécima muestra un aviso traducido. La pista bajo el composer
  menciona `@`.
- **Solo lectura**: cuando `session.access.canWrite === false`, insignia "Solo lectura / Read-only" en la
  cabecera con tooltip (el agente puede leer y buscar, no cambiar la base) y placeholder del composer
  acorde; con `canWrite === true` o sin `access` no hay insignia. El servidor decide; nada más cambia.
- Tipos nuevos en `src/lib/api.ts`: `DocumentListItem`, `SessionAccess`, `TurnReference`, `MAX_REFERENCES`,
  `AgentBody.referencedDocumentIds`, `api.documents()`. Ruta nueva `documents` y `paths.documents()`.
- Tests `[TS-461]` documentos, `[TS-462]` menciones, `[TS-463]` solo lectura (móvil y escritorio).

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
