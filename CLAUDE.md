# CLAUDE.md

Convenciones del proyecto "Mi cuatri" para futuras sesiones. Si existe `CLAUDE.local.md`, léelo también.

## Idioma
- Habla en **español** con el usuario.
- **Código, identificadores y commits en inglés.** Textos de la interfaz y comentarios del código en español.

## Stack
- Vite + TypeScript estricto, **sin framework** (vistas = funciones que devuelven HTML, un `render()` y delegación de eventos en `src/ui/app.ts`).
- Dependencias: `idb` en runtime. En dev: vitest, vite-plugin-pwa, fake-indexeddb, @vite-pwa/assets-generator y @fontsource-variable/bricolage-grotesque.
- No añadir dependencias sin justificarlo.

## Arquitectura
- `src/config/`: datos editables (rutinas, checklists, plan; el horario se distribuye cifrado). Solo datos, sin lógica.
- `src/domain/`: lógica **pura** y testeada. Sin DOM ni almacenamiento. Cada módulo tiene su `*.test.ts` al lado.
- `src/data/repository.ts`: interfaz de almacenamiento. `idb-repository.ts` es la implementación local. La UI y el store nunca tocan IndexedDB directamente.
- `src/app/store.ts`: estado en memoria (`AppData`) + acciones. Actualiza la memoria de forma síncrona y persiste en segundo plano.
- `src/app/notify.ts` + `src/domain/notifications.ts`: notificaciones. La app calcula los avisos de los próximos días y se los envía al worker (`worker/`, Cloudflare Worker + Durable Object) que los manda a su hora por Web Push.
- `src/ui/`: vistas y componentes. Escapa siempre con `esc()` todo lo que venga de datos o config.

## Reglas importantes
- **IDs estables**: los `id` de ejercicios, rutinas e ítems de checklist enlazan el historial. No cambiarlos al renombrar.
- **Fechas**: usa `src/domain/dates.ts`. Diferencias por días de calendario (`dayDiff`), nunca `ms / 864e5`: los cambios de hora (DST) desplazan semanas. Semana = lunes-domingo, `dow()` con lunes = 0.
- **Backup**: si cambias `BackupData` o los registros, sube `CURRENT_SCHEMA_VERSION` en `src/domain/backup.ts`, añade la migración en `MIGRATIONS` y su test.
- **IndexedDB**: si cambias los stores, sube `DB_VERSION` en `idb-repository.ts` y añade el paso en `upgrade`.
- **Diseño**: el CSS de `src/styles/main.css` es el diseño de referencia. No rediseñar sin preguntar. Los añadidos van al final del archivo.
- Si ves bugs o mejoras fuera del alcance de lo pedido, **proponlos**, no los apliques por tu cuenta.

## Flujo de trabajo
- Commits pequeños con Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `ci:`).
- Antes de cada commit: `npm run build` y `npm test` en verde.
- Push a `main` = despliegue automático a GitHub Pages (`.github/workflows/deploy.yml`).

## Comandos
- `npm run dev`, `npm test`, `npm run build`, `npm run preview`, `npm run generate-icons`.
- Los tests fuerzan `TZ=Europe/Madrid` (en `vite.config.ts`) para que los casos de cambio de hora sean reproducibles también en CI.
- En Git Bash (Windows), para probar un build con base path: `MSYS_NO_PATHCONV=1 BASE_PATH=/mi-cuatri/ npx vite build`. Sin eso, MSYS convierte `/mi-cuatri/` en una ruta de Windows.
- `.claude/launch.json` tiene `dev` (5173) y `preview` (4173, con base `/mi-cuatri/`) para el navegador integrado.

