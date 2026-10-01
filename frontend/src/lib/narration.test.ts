import { describe, expect, it } from 'vitest';
import { joinSegments, planNarration } from './narration';

describe('planNarration', () => {
  it('reads a story opening in breaths, leaning in at the ellipsis', () => {
    const plan = planNarration(
      'Once upon a time… There was a boy called Max who lived in a small village at the edge of a thick jungle.',
    );
    expect(plan.map((p) => p.text)).toEqual([
      'Once upon a time…',
      'There was a boy called Max who lived in a small village',
      'at the edge of a thick jungle.',
    ]);
    expect(plan[0].pauseAfter).toBeGreaterThan(400); // a rest before what comes next
    expect(plan[1].pauseAfter).toBeLessThan(200); // only a quiet breath mid-sentence
    expect(plan[2].pauseAfter).toBe(0); // nothing after the last phrase
  });

  it('gives a question a curious lift and room to think', () => {
    const plan = planNarration('Some engineers already have a spark of an idea. Do you? Let us find out!');
    const q = plan.find((p) => p.text === 'Do you?')!;
    const s = plan[0];
    expect(q.pitch).toBeGreaterThan(s.pitch);
    expect(q.pauseAfter).toBeGreaterThan(s.pauseAfter);
  });

  it('does not chop short comma phrases into separate breaths', () => {
    const plan = planNarration('Max, a student, walked to school.');
    expect(plan[0].text.startsWith('Max, a student,')).toBe(true);
  });

  it('keeps the words exactly as written', () => {
    const line = "I'm Popi, your story guide. Max has started thinking about what he could do. What about you?";
    expect(
      planNarration(line)
        .map((p) => p.text)
        .join(' '),
    ).toBe(line);
  });

  it('understands Persian question marks and commas', () => {
    const plan = planNarration('مکس کنار رودخانه ایستاد، و فکر کرد. تو چه فکر می‌کنی؟');
    expect(plan[plan.length - 1].text.endsWith('؟')).toBe(true);
    expect(plan.length).toBeGreaterThanOrEqual(2);
  });

  it('stays close to the normal speaking speed overall', () => {
    const plan = planNarration('One idea. Another idea, and a third. A fourth… and a fifth!');
    const avg = plan.reduce((a, p) => a + p.rate, 0) / plan.length;
    expect(avg).toBeGreaterThan(0.9);
    expect(avg).toBeLessThan(1.05);
  });
});

describe('joinSegments', () => {
  it('joins a beat and its sentence with a breath', () => {
    expect(joinSegments(['Once upon a time…', 'There was a boy.'])).toBe('Once upon a time… There was a boy.');
    expect(joinSegments(['The big question', 'What exactly is the problem?'])).toBe(
      'The big question. What exactly is the problem?',
    );
  });
});
