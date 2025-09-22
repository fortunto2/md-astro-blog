// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.akbuzat.net',
  output: 'server',
  adapter: cloudflare(),
  integrations: [],
  server: { host: true },

  vite: {
    plugins: [tailwindcss()]
  }
});