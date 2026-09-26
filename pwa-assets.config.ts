import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// Genera los PNG de public/ a partir de public/icon.svg: `npm run generate-icons`.
const background = '#2457F5';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0, resizeOptions: { background } },
    apple: { ...preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
});
