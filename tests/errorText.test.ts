import { describe, expect, it } from 'vitest';
import { errorText } from '../src/errorText';

const withErrors = (message: string, errors: unknown) => Object.assign(new Error(message), { errors });

describe('errorText', () => {
  it('shows the reasons a refusal carries, not only its summary', () => {
    expect(errorText(withErrors('The scheduling policy is not valid.', ['The default buffer must sit between the minimum and the maximum.']), 'x'))
      .toBe('The scheduling policy is not valid. The default buffer must sit between the minimum and the maximum.');
  });

  it('reads a field => messages map too, and does not repeat the message', () => {
    expect(errorText(withErrors('Invalid.', { buffer: ['Too small.'], name: 'Invalid.' }), 'x')).toBe('Invalid. Too small.');
  });

  it('falls back when there is nothing to say', () => {
    expect(errorText(new Error(''), 'Please try again.')).toBe('Please try again.');
    expect(errorText('boom', 'Please try again.')).toBe('Please try again.');
    expect(errorText(new Error('Down.'), 'x')).toBe('Down.');
  });
});
