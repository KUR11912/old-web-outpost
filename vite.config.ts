import { defineConfig } from 'vite';

// Keep local exploration at /; publish and preview the GitHub project subpath.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/old-web-outpost/' : '/',
}));
