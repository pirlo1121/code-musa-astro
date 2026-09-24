import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

export default defineConfig({
  output: 'static',

  image: {
    // User/project photos live on this S3 bucket and are fetched at build time —
    // allow-listing it lets astro:assets download, resize and re-encode them
    // (WebP/AVIF + responsive widths) instead of shipping the raw originals.
    remotePatterns: [
      { protocol: 'https', hostname: 'files-portoflio.s3.us-east-1.amazonaws.com' },
    ],
  },

  build: {
    // Single-page site: the whole stylesheet IS the critical CSS. Inlining it
    // removes a render-blocking external <link rel="stylesheet"> round-trip.
    inlineStylesheets: 'always',
  },

  integrations: [react()],

  vite: {
    // The 3D scene (three + r3f + postprocessing, ~285 kB gzip) is one chunk
    // on purpose: it loads lazily on idle, after the page is already usable.
    build: { chunkSizeWarningLimit: 1100 },
  },
});