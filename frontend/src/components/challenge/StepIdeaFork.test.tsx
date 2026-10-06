import type { ReactElement } from 'react';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import StepIdeaFork from './StepIdeaFork';
import en from '../../../messages/en.json';

function render(ui: ReactElement) {
  return rtlRender(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const mockChallenge = {
  id: 'c1',
  title: 'Help Max',
  slug: 'max',
  brief: 'brief',
  emoji: '🌉',
  nature_clues: [],
  design_secret: 'secret',
  design_secret_story: null,
  skill_lesson_id: null,
  related_explore_ids: [],
  completion_xp: 20,
};

describe('StepIdeaFork', () => {
  it('renders heading', () => {
    render(
      <StepIdeaFork
        challenge={mockChallenge}
        ageMode="young"
        onYes={vi.fn()}
        onNo={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('Do you already have an idea?')).toBeInTheDocument();
  });

  it('clicking YES calls onYes', () => {
    const onYes = vi.fn();
    const onNo = vi.fn();

    render(
      <StepIdeaFork
        challenge={mockChallenge}
        ageMode="young"
        onYes={onYes}
        onNo={onNo}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('idea-yes'));

    expect(onYes).toHaveBeenCalledTimes(1);
    expect(onNo).not.toHaveBeenCalled();
  });

  it('clicking No calls onNo', () => {
    const onYes = vi.fn();
    const onNo = vi.fn();

    render(
      <StepIdeaFork
        challenge={mockChallenge}
        ageMode="young"
        onYes={onYes}
        onNo={onNo}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('idea-no'));

    expect(onNo).toHaveBeenCalledTimes(1);
    expect(onYes).not.toHaveBeenCalled();
  });

  it('back link calls onBack', () => {
    const onBack = vi.fn();

    render(
      <StepIdeaFork
        challenge={mockChallenge}
        ageMode="young"
        onYes={vi.fn()}
        onNo={vi.fn()}
        onBack={onBack}
      />,
    );

    fireEvent.click(screen.getByText(/Back/));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
