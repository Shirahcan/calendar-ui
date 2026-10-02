import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // ⚠ Run in a zone that is NOT the viewer's or the host's in any test, so a hook that
    // leaks the machine's zone into its maths fails loudly here instead of in Lagos.
    env: { TZ: 'Pacific/Kiritimati' },
  },
});
