import { fileURLToPath } from 'node:url';
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const libs = ['browser', 'config', 'site', 'queue', 'redis-lock', 'storage'];
export function appLibAliases(): Array<{
  find: string;
  replacement: string;
}> {
  return libs.map((lib) => ({
    find: `@app/${lib}`,
    replacement: `${repoRoot}libs/${lib}/src/index.ts`,
  }));
}
