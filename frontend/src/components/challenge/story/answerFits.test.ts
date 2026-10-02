import { describe, expect, it } from 'vitest';
import { answerFits } from './StoryPictureBook';

describe('answerFits', () => {
  it('accepts an answer with any key word, in any case', () => {
    expect(answerFits('MAX!', ['max'])).toBe(true);
    expect(answerFits('he must get across', ['cross', 'river'])).toBe(true);
  });
  it('misses an answer without the key idea', () => {
    expect(answerFits('his mum', ['max'])).toBe(false);
  });
  it('welcomes any idea when there are no key words', () => {
    expect(answerFits('a giant leaf boat', [])).toBe(true);
    expect(answerFits('a', [])).toBe(false);
  });
  it('understands Persian letters and digits', () => {
    expect(answerFits('۳ ساعت', ['3'])).toBe(true);
    expect(answerFits('مكس', ['مکس'])).toBe(true);
  });
});
