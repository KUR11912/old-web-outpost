import { defineConfig } from 'vite';

// Keep local exploration at /; publish the English edition beside the Chinese game.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/old-web-outpost/en/' : '/',
}));
