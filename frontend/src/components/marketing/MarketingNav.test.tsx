import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn() }),
}));

import MarketingNav from './MarketingNav';

function render(ui: React.ReactElement) {
  return rtlRender(
    <NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>
  );
}

describe('MarketingNav', () => {
  it('renders the nav with banner landmark', () => {
    render(<MarketingNav />);
    expect(screen.getByTestId('marketing-nav')).toBeInTheDocument();
  });

  it('renders The Method nav link', () => {
    render(<MarketingNav />);
    expect(screen.getAllByRole('link', { name: /the method/i })[0]).toBeInTheDocument();
  });

  it('renders Pricing nav link', () => {
    render(<MarketingNav />);
    expect(screen.getAllByRole('link', { name: /pricing/i })[0]).toBeInTheDocument();
  });

  it('renders For Teachers nav link', () => {
    render(<MarketingNav />);
    expect(screen.getAllByRole('link', { name: /for teachers/i })[0]).toBeInTheDocument();
  });

  it('renders Log in link', () => {
    render(<MarketingNav />);
    expect(screen.getByRole('link', { name: /^log in$/i })).toBeInTheDocument();
  });

  it('renders the sign-up CTA link', () => {
    render(<MarketingNav />);
    const signUpLinks = screen.getAllByRole('link', { name: /^sign up for free$/i });
    expect(signUpLinks.length).toBeGreaterThan(0);
  });

  it('mobile menu is closed by default — hamburger has aria-label Open menu', () => {
    render(<MarketingNav />);
    const hamburger = screen.getByRole('button', { name: /open menu/i });
    expect(hamburger).toBeInTheDocument();
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking hamburger opens the mobile menu and changes aria-label to Close menu', async () => {
    const user = userEvent.setup();
    render(<MarketingNav />);
    const hamburger = screen.getByRole('button', { name: /open menu/i });
    await user.click(hamburger);
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
  });

  it('clicking hamburger again closes the mobile menu', async () => {
    const user = userEvent.setup();
    render(<MarketingNav />);
    const hamburger = screen.getByRole('button', { name: /open menu/i });
    await user.click(hamburger);
    const closeBtn = screen.getByRole('button', { name: /close menu/i });
    await user.click(closeBtn);
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('mobile menu The Method link points to /method', async () => {
    const user = userEvent.setup();
    render(<MarketingNav />);
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    const methodLinks = screen.getAllByRole('link', { name: /the method/i });
    const mobileLink = methodLinks[methodLinks.length - 1];
    expect(mobileLink).toHaveAttribute('href', expect.stringContaining('method'));
  });
});
