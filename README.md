# Mi cuatri

PWA para organizar el cuatrimestre: horario, gym, progreso y checklists. Funciona sin conexión y guarda los datos en el propio dispositivo.

## Desarrollo

```bash
npm install
npm run dev     # servidor local
npm test        # tests
npm run build   # build de producción
```

## Stack

Vite + TypeScript, IndexedDB ([idb](https://github.com/jakearchibald/idb)), [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) y [Vitest](https://vitest.dev/). Se despliega en GitHub Pages con GitHub Actions.
