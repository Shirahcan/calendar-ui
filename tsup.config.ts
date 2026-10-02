import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom'],
  // Every export is a client component or a hook: mark the bundle for the Next.js app router.
  banner: { js: "'use client';" },
});
