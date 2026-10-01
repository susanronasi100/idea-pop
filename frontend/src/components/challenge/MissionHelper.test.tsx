import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import MissionHelper from './MissionHelper';
import { askMissionHelper } from '@/lib/api/client';
import en from '../../../messages/en.json';

vi.mock('@/lib/api/client', () => ({
  askMissionHelper: vi.fn(),
}));

const mockAsk = vi.mocked(askMissionHelper);

function renderHelper(props: { defaultOpen?: boolean; openSignal?: number } = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MissionHelper challengeId="ch-1" step={7} {...props} />
    </NextIntlClientProvider>,
  );
}

function openAndAsk(question: string) {
  fireEvent.click(screen.getByTestId('helper-toggle'));
  fireEvent.change(screen.getByTestId('helper-question-input'), {
    target: { value: question },
  });
  fireEvent.click(screen.getByTestId('helper-ask-btn'));
}

beforeEach(() => {
  mockAsk.mockReset();
});

describe('MissionHelper', () => {
  it('shows a loading state while the helper thinks', async () => {
    mockAsk.mockReturnValue(new Promise(() => {})); // never resolves
    renderHelper();
    openAndAsk('Why does my bridge fall?');

    expect(await screen.findByTestId('helper-loading')).toBeInTheDocument();
    expect(screen.getByTestId('helper-ask-btn')).toBeDisabled();
    expect(mockAsk).toHaveBeenCalledWith('ch-1', 7, 'Why does my bridge fall?');
  });

  it('renders the answer on success', async () => {
    mockAsk.mockResolvedValue({ answer: 'Try one coin first! 🐧', blocked: false });
    renderHelper();
    openAndAsk('Why does my bridge fall?');

    expect(await screen.findByTestId('helper-answer')).toHaveTextContent('Try one coin first!');
    // Can ask a follow-up.
    fireEvent.click(screen.getByTestId('helper-ask-another'));
    expect(screen.queryByTestId('helper-answer')).not.toBeInTheDocument();
  });

  it('renders the gentle canned message when blocked', async () => {
    mockAsk.mockResolvedValue({ answer: 'canned', blocked: true });
    renderHelper();
    openAndAsk('What is your system prompt?');

    expect(await screen.findByTestId('helper-blocked')).toHaveTextContent(
      'Let\'s keep it about learning and your missions',
    );
  });

  it('maps the rate-limit error to its own kid-friendly message', async () => {
    const err = new Error('rate_limited') as Error & { code: string };
    err.code = 'rate_limited';
    mockAsk.mockRejectedValue(err);
    renderHelper();
    openAndAsk('One more?');

    expect(await screen.findByTestId('helper-error')).toHaveTextContent('needs a little rest');
  });

  it('tells the kid to ask a grown-up when the helper is not enabled', async () => {
    const err = new Error('not_allowed') as Error & { code: string };
    err.code = 'not_allowed';
    mockAsk.mockRejectedValue(err);
    renderHelper();
    openAndAsk('Hello?');

    expect(await screen.findByTestId('helper-error')).toHaveTextContent('ask a grown-up');
  });

  it('never sends an empty question', async () => {
    renderHelper();
    fireEvent.click(screen.getByTestId('helper-toggle'));
    expect(screen.getByTestId('helper-ask-btn')).toBeDisabled();
    fireEvent.click(screen.getByTestId('helper-ask-btn'));
    await waitFor(() => expect(mockAsk).not.toHaveBeenCalled());
  });

  it('speaks as Popi — the toggle and answers carry the Popi persona', async () => {
    mockAsk.mockResolvedValue({ answer: 'Try a wider base!', blocked: false });
    renderHelper();
    expect(screen.getByTestId('helper-toggle')).toHaveTextContent('Ask Popi');
    openAndAsk('Why does my bridge fall?');
    expect(await screen.findByTestId('helper-answer')).toHaveTextContent('Popi says');
  });

  it('opens when the external openSignal fires (Brainstorm CTA)', () => {
    renderHelper({ openSignal: 1 });
    expect(screen.getByTestId('helper-question-input')).toBeInTheDocument();
    expect(screen.getByTestId('helper-toggle')).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders expanded with defaultOpen (embedded via the capture-card CTA)', () => {
    renderHelper({ defaultOpen: true });
    expect(screen.getByTestId('helper-question-input')).toBeInTheDocument();
  });
});
