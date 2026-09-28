import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import MissionHUD from './MissionHUD';

vi.mock('@/lib/api/client', () => ({
  fetchKidProgress: vi.fn().mockResolvedValue({ xp_total: 60, level: 3, rank: 'Maker' }),
}));
import en from '../../../messages/en.json';

const mockChallenge = {
  title: 'Help Max Cross The River',
  emoji: '🌉',
  completion_xp: 20,
};

const defaultProps = {
  challenge: mockChallenge,
  currentStep: 2,
  reachedSteps: new Set([1, 2]),
  onJumpTo: vi.fn(),
};

function renderHUD(props: Partial<ComponentProps<typeof MissionHUD>> = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MissionHUD {...defaultProps} {...props} />
    </NextIntlClientProvider>,
  );
}

describe('MissionHUD', () => {
  it('renders mission title and XP badge', () => {
    renderHUD();

    expect(screen.getByText(/Help Max Cross The River/)).toBeInTheDocument();
    expect(screen.getByText(/\+20 XP/)).toBeInTheDocument();
  });

  it('shows 8 progress dots', () => {
    renderHUD();

    const dots: HTMLElement[] = [];
    for (let i = 1; i <= 8; i++) {
      dots.push(screen.getByTestId(`progress-dot-${i}`));
    }
    expect(dots).toHaveLength(8);
  });

  it('opens mission menu on button click', () => {
    renderHUD();

    expect(screen.queryByTestId('mission-menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mission-menu-button'));

    expect(screen.getByTestId('mission-menu')).toBeInTheDocument();
  });

  it('clicking a reached step calls onJumpTo', () => {
    const onJumpTo = vi.fn();
    renderHUD({ onJumpTo });

    // Open the menu first
    fireEvent.click(screen.getByTestId('mission-menu-button'));

    // Step 1 is in reachedSteps
    fireEvent.click(screen.getByTestId('mission-step-1'));

    expect(onJumpTo).toHaveBeenCalledTimes(1);
    expect(onJumpTo).toHaveBeenCalledWith(1);
  });

  it('clicking an unreached step does nothing', () => {
    const onJumpTo = vi.fn();
    renderHUD({ onJumpTo });

    // Open the menu first
    fireEvent.click(screen.getByTestId('mission-menu-button'));

    // Step 5 is NOT in reachedSteps (only 1 and 2 are)
    fireEvent.click(screen.getByTestId('mission-step-5'));

    expect(onJumpTo).not.toHaveBeenCalled();
  });

  it('shows all 8 circles: current highlighted, visited dark, locked hollow', () => {
    renderHUD({ currentStep: 3, reachedSteps: new Set([1, 2, 3]) });

    expect(screen.getByTestId('progress-dot-1')).toHaveAttribute('data-state', 'done');
    expect(screen.getByTestId('progress-dot-3')).toHaveAttribute('data-state', 'current');
    expect(screen.getByTestId('progress-dot-3')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByTestId('progress-dot-8')).toHaveAttribute('data-state', 'locked');
    expect(screen.getByTestId('progress-dot-8')).toBeDisabled();
  });

  it('tapping a visited circle jumps back to it', () => {
    const onJumpTo = vi.fn();
    renderHUD({ onJumpTo });

    fireEvent.click(screen.getByTestId('progress-dot-1'));

    expect(onJumpTo).toHaveBeenCalledWith(1);
  });

  it('pins the problem, goal and rules under the title', () => {
    renderHUD({
      keyInfo: { problem: 'A 3-hour walk', goal: 'Cross safely', rules: 'Light things' },
    });

    const info = screen.getByTestId('mission-key-info');
    expect(info).toHaveTextContent('A 3-hour walk');
    expect(info).toHaveTextContent('Cross safely');
    expect(info).toHaveTextContent('Light things');
  });

  it('opens the XP explainer from the XP badge', async () => {
    renderHUD();

    fireEvent.click(screen.getByTestId('hud-xp-button'));

    expect(screen.getByRole('dialog', { name: /What is XP/ })).toBeInTheDocument();
    expect(screen.getByTestId('xp-info-mission')).toHaveTextContent('+20 XP');
    expect(await screen.findByTestId('xp-info-mine')).toHaveTextContent('You have 60 XP');
  });

  it('hides the key info on the first page (the Brief)', () => {
    renderHUD({
      currentStep: 1,
      reachedSteps: new Set([1]),
      keyInfo: { problem: 'A 3-hour walk', goal: 'Cross safely', rules: 'Light things' },
    });

    expect(screen.queryByTestId('mission-key-info')).not.toBeInTheDocument();
  });

  it('says which page we are on under the circles', () => {
    renderHUD({ currentStep: 3, reachedSteps: new Set([1, 2, 3]) });

    expect(screen.getByTestId('progress-label')).toHaveTextContent('Step 3 of 8');
    expect(screen.getByTestId('progress-label')).not.toHaveTextContent('Nature clues');
  });

  it('marks the current menu item without an arrow', () => {
    renderHUD();

    fireEvent.click(screen.getByTestId('mission-menu-button'));

    const current = screen.getByTestId('mission-step-2');
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(current).not.toHaveTextContent('←');
  });

  it('closes the menu with the X or a tap outside', () => {
    renderHUD();

    fireEvent.click(screen.getByTestId('mission-menu-button'));
    expect(screen.getByRole('button', { name: 'Close mission menu' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mission-menu-button'));
    expect(screen.queryByTestId('mission-menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mission-menu-button'));
    fireEvent.click(screen.getByTestId('mission-menu-backdrop'));
    expect(screen.queryByTestId('mission-menu')).not.toBeInTheDocument();
  });
});
