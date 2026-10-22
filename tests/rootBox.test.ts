import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The provider's wrapper is a real box (0.39.0). As `display: contents` it swallowed every margin a
 * product gave it, so kit panels sat flush against their neighbours in Portify and MployNow, again
 * and again. This keeps it from going back.
 */
describe('the provider wrapper', () => {
  it('is a block box, never display: contents', () => {
    const css = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
    expect(css).toMatch(/\.cal-root \{ display: block;/);
    expect(css).not.toMatch(/\.cal-root \{ display: contents/);
  });
});
