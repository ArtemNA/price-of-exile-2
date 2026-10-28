import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));
const specs = fileURLToPath(new URL('./tests/ee2', import.meta.url));

export default defineConfig({
  resolve: {
    // Same aliases as tsconfig.json `paths`: shims first, then the rest of `@/` into src/lib/ee2.
    alias: [
      { find: /^@\/web\/Config$/, replacement: src('app/ee2-shims/web-config') },
      { find: /^@\/web\/background\/IPC$/, replacement: src('app/ee2-shims/ipc') },
      { find: /^@\/web\/background\/Prices$/, replacement: src('app/ee2-shims/prices') },
      { find: /^@\/web\/background\/TradeData$/, replacement: src('app/ee2-shims/trade-data') },
      { find: /^@\/web\/overlay\/interfaces$/, replacement: src('app/ee2-shims/overlay-interfaces') },
      { find: /^@\/(.*)$/, replacement: `${src('lib/ee2')}/$1` },
      // EE2 specs (renderer/specs), copied into tests/ee2, import each other through `@specs/`.
      { find: /^@specs\/(.*)$/, replacement: `${specs}/$1` },
    ],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
