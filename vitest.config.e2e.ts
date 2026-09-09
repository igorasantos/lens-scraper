import { defineConfig } from 'vitest/config';
import { appLibAliases } from './vitest.aliases.js';
export default defineConfig({
  resolve: {
    alias: appLibAliases(),
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
