import { guessLanguageAlpha2, UNKNOWN_LANGUAGE_ALPHA2 } from './language.js';
describe('guessLanguageAlpha2', () => {
  it('guesses English from an English "body content" text', () => {
    expect(
      guessLanguageAlpha2(
        'Our platform focuses on distributed systems and scalable APIs, with new capabilities rolling out this quarter.',
      ),
    ).toBe('en');
  });
  it('guesses Spanish from a Spanish "body content" text', () => {
    expect(
      guessLanguageAlpha2(
        'Nuestra plataforma se centra en sistemas distribuidos y APIs escalables, con nuevas funciones que se lanzan este trimestre.',
      ),
    ).toBe('es');
  });
  it('falls back to UNKNOWN_LANGUAGE_ALPHA2 for blank text', () => {
    expect(guessLanguageAlpha2('')).toBe(UNKNOWN_LANGUAGE_ALPHA2);
    expect(guessLanguageAlpha2('   \n  ')).toBe(UNKNOWN_LANGUAGE_ALPHA2);
  });
  it('falls back to UNKNOWN_LANGUAGE_ALPHA2 for text made only of symbols', () => {
    expect(guessLanguageAlpha2('!@#$%^&*()_+-=[]{}')).toBe(
      UNKNOWN_LANGUAGE_ALPHA2,
    );
  });
  it('falls back to UNKNOWN_LANGUAGE_ALPHA2 for text made only of numbers', () => {
    expect(guessLanguageAlpha2('1234567890 42 100 3.14')).toBe(
      UNKNOWN_LANGUAGE_ALPHA2,
    );
  });
  it('falls back to UNKNOWN_LANGUAGE_ALPHA2 when the detector cannot settle on a language', () => {
    expect(guessLanguageAlpha2('qwzxc')).toBe(UNKNOWN_LANGUAGE_ALPHA2);
  });
});
