import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../lib/api';
import { clearResourceCache } from '../lib/resource';
import { DEFAULT_CONFIG, type SiteConfig } from '../lib/siteConfig';
import type { Episode, Sponsor } from '../lib/types';
import { routes } from '../router';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    fetchEpisodes: vi.fn(),
    fetchReports: vi.fn(async () => []),
    fetchArchive: vi.fn(async () => []),
    fetchSponsors: vi.fn(async () => []),
    fetchSiteConfig: vi.fn(),
    subscribeNewsletter: vi.fn(async () => undefined),
    submitBookingRequest: vi.fn(async () => 'JR-2601'),
    submitGuestRequest: vi.fn(async () => 'JR-G-101'),
    submitPledge: vi.fn(async () => 'JR-D-1001'),
    signTalentRelease: vi.fn(),
  };
});

const EPISODES: Episode[] = [
  { id: 'ep-48', number: 48, title: 'Haiti at a Crossroads', dek: 'Dek', guest: 'With a guest', topic: 'Haiti', language: 'EN', durationSeconds: 3492, publishedOn: '2026-09-18', youtubeId: null, audioUrl: 'https://cdn.example.com/ep48.mp3', chapters: [{ at: 252, label: 'Where things stand today' }] },
  { id: 'ep-47', number: 47, title: 'TPS Explained', dek: 'Dek', guest: 'With an attorney', topic: 'Immigration', language: 'KR', durationSeconds: 2550, publishedOn: '2026-09-11', youtubeId: null, audioUrl: null, chapters: [] },
  { id: 'ep-42', number: 42, title: 'Konsèy pou nouvo imigran', dek: 'Dek', guest: 'Avèk yon travayè sosyal', topic: 'Community', language: 'KR', durationSeconds: 2362, publishedOn: '2026-08-07', youtubeId: null, audioUrl: null, chapters: [] },
];

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const FOWEN: Sponsor = {
  id: 's1', name: 'FowenNurses', nameAccent: 'Nurses', tagline: 'NCLEX preparation', websiteUrl: 'https://www.fowennursesllc.com', phone: '(732) 822-3518',
  image: { id: 'm1', source: 'bundled', url: '/assets/sponsor-fowennurses.png', alt: 'FowenNurses banner', width: 3162, height: 1796 },
  thanksText: 'Thank you to FowenNurses.', thanksImage: null, placements: ['home_feature', 'home_thanks'],
};

/** Site settings as saved in the admin, with some groups changed. */
function withConfig(over: Partial<SiteConfig> = {}) {
  vi.mocked(api.fetchSiteConfig).mockResolvedValue({ config: { ...structuredClone(DEFAULT_CONFIG), ...over }, media: {} });
}

beforeEach(() => {
  clearResourceCache();
  withConfig();
  vi.mocked(api.fetchSponsors).mockReset().mockResolvedValue([]);
  vi.mocked(api.fetchEpisodes).mockReset().mockResolvedValue(EPISODES);
  vi.mocked(api.subscribeNewsletter).mockClear();
  vi.mocked(api.submitBookingRequest).mockClear();
  vi.mocked(api.submitPledge).mockClear();
});

describe('home page', () => {
  it('shows the latest episode and only offers playback when audio exists', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Haiti at a Crossroads' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /listen now/i })).toBeInTheDocument();
    // EP 47 has no audio, so its card has no play button
    expect(screen.getByRole('link', { name: 'TPS Explained' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /play ep 47/i })).not.toBeInTheDocument();
    // goal from settings, and no invented totals
    expect(screen.getByText(/Help us reach our \$12,000 monthly goal/)).toBeInTheDocument();
    expect(screen.queryByText(/monthly supporters/)).not.toBeInTheDocument();
  });

  it('offers a retry when episodes fail to load', async () => {
    vi.mocked(api.fetchEpisodes).mockRejectedValue(new api.ApiError('network', 'We couldn’t reach the server.'));
    const user = userEvent.setup();
    renderAt('/');
    const retry = (await screen.findAllByRole('button', { name: 'Try again' }))[0];
    vi.mocked(api.fetchEpisodes).mockResolvedValue(EPISODES);
    await user.click(retry);
    expect(await screen.findByRole('heading', { level: 1, name: 'Haiti at a Crossroads' })).toBeInTheDocument();
  });

  it('plays audio in the mini player and pauses it', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(await screen.findByRole('button', { name: /listen now/i }));
    const player = screen.getByRole('region', { name: 'Audio player' });
    expect(within(player).getByText(/EP 48 · Haiti at a Crossroads/)).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    await user.click(within(player).getByRole('button', { name: 'Close player' }));
    expect(screen.queryByRole('region', { name: 'Audio player' })).not.toBeInTheDocument();
  });
});

describe('site settings from the admin', () => {
  it('follows the saved section order and hides hidden sections', async () => {
    const sections = DEFAULT_CONFIG.home.sections.map((s) => ({ ...s, visible: s.key !== 'fundraising' }));
    withConfig({ home: { ...DEFAULT_CONFIG.home, sections } });
    renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Haiti at a Crossroads' });
    expect(screen.queryByRole('heading', { name: /No network\. No owners/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How James Reports began' })).toBeInTheDocument();
  });

  it('shows the saved announcement and header links', async () => {
    withConfig({
      ticker: { enabled: true, label: 'Live', text: 'Election night coverage starts at 7 PM', linkLabel: 'Watch', linkUrl: 'https://www.youtube.com/@JamesReports' },
      navigation: { header: [...DEFAULT_CONFIG.navigation.header.map((l) => ({ ...l, visible: l.href !== '/archive' }))] },
    });
    renderAt('/about');
    expect(await screen.findByText('Election night coverage starts at 7 PM')).toBeInTheDocument();
    const main = screen.getByRole('navigation', { name: 'Main' });
    expect(within(main).getByRole('link', { name: 'About' })).toBeInTheDocument();
    expect(within(main).queryByRole('link', { name: 'Archive' })).not.toBeInTheDocument();
  });

  it('says so when settings fail to load, and shows no announcement or figures', async () => {
    vi.mocked(api.fetchSiteConfig).mockRejectedValue(new api.ApiError('network', 'We couldn’t reach the server.'));
    renderAt('/');
    expect(await screen.findByText(/Some site information couldn’t be loaded/)).toBeInTheDocument();
    expect(screen.queryByText(/premieres Thursday at 8 PM ET on YouTube/)).not.toBeInTheDocument();
    expect(screen.queryByText(/monthly goal/)).not.toBeInTheDocument();
    expect(screen.getByText('Every gift funds the next episode.')).toBeInTheDocument();
  });

  it('shows published sponsors in their placements', async () => {
    vi.mocked(api.fetchSponsors).mockResolvedValue([FOWEN]);
    renderAt('/');
    expect(await screen.findByRole('link', { name: 'Visit fowennursesllc.com' })).toHaveAttribute('href', 'https://www.fowennursesllc.com');
    expect(screen.getByRole('link', { name: '(732) 822-3518' })).toHaveAttribute('href', 'tel:+17328223518');
    expect(screen.getByText('Thank you to FowenNurses.')).toBeInTheDocument();
  });

  it('hides the sponsor sections when there are no published sponsors', async () => {
    renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Haiti at a Crossroads' });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'James Reports is made possible by' })).not.toBeInTheDocument());
  });
});

describe('episode preview', () => {
  it('asks visitors without an admin session to sign in, and is not indexed', async () => {
    localStorage.removeItem('jr-admin-auth');
    renderAt('/episodes/ep-48?preview=1');
    expect(await screen.findByRole('heading', { name: 'Sign in to preview' })).toBeInTheDocument();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  });
});

describe('episodes page', () => {
  it('filters by language through the URL and shows the empty state', async () => {
    const user = userEvent.setup();
    const router = renderAt('/episodes');
    await screen.findByRole('link', { name: /Haiti at a Crossroads/ });
    const main = within(screen.getByRole('main'));
    await user.click(main.getByRole('button', { name: 'Kreyòl' }));
    expect(router.state.location.search).toBe('?lang=KR');
    expect(main.queryByRole('link', { name: /Haiti at a Crossroads/ })).not.toBeInTheDocument();
    expect(main.getByRole('link', { name: /Konsèy pou nouvo imigran/ })).toBeInTheDocument();
    await user.click(main.getByRole('button', { name: 'Sports' }));
    expect(main.getByText('No episodes match these filters yet.')).toBeInTheDocument();
    await user.click(main.getByRole('button', { name: 'Clear filters' }));
    expect(router.state.location.search).toBe('');
  });

  it('shows a not-found page for an unknown episode', async () => {
    renderAt('/episodes/ep-999');
    expect(await screen.findByRole('heading', { name: 'We couldn’t find that episode.' })).toBeInTheDocument();
  });
});

describe('subscribe dialog', () => {
  it('validates, then saves the chosen language and alerts', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getAllByRole('button', { name: 'Subscribe' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Subscribe to James Reports' });
    await user.click(within(dialog).getByRole('button', { name: 'Subscribe' }));
    expect(within(dialog).getByText('Enter your email address.')).toBeInTheDocument();
    expect(api.subscribeNewsletter).not.toHaveBeenCalled();

    await user.type(within(dialog).getByRole('textbox', { name: 'Email address' }), 'marie@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Kreyòl' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Breaking news from Haiti' }));
    await user.click(within(dialog).getByRole('button', { name: 'Subscribe' }));

    expect(api.subscribeNewsletter).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'marie@example.com', language: 'Kreyòl', alerts: { premiere: true, briefing: true, breaking: true } }),
      'subscribe_dialog',
    );
    expect(await within(dialog).findByRole('heading', { name: 'Welcome aboard.' })).toBeInTheDocument();
  });

  it('shows the server error and lets the visitor retry', async () => {
    vi.mocked(api.subscribeNewsletter).mockRejectedValueOnce(new api.ApiError('network', 'We couldn’t reach the server. Check your connection and try again.'));
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getAllByRole('button', { name: 'Subscribe' })[0]);
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Email address' }), 'marie@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Subscribe' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('couldn’t reach the server');
    await user.click(within(dialog).getByRole('button', { name: 'Subscribe' }));
    expect(await within(dialog).findByRole('heading', { name: 'Welcome aboard.' })).toBeInTheDocument();
  });
});

describe('booking form', () => {
  it('keeps the ad tab and request type in step, and shows the server reference', async () => {
    const user = userEvent.setup();
    const router = renderAt('/booking?tab=ads');
    const form = await screen.findByRole('form', { name: 'Booking or ad request' });
    expect(within(form).getByRole('button', { name: 'Advertising' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(form).getByLabelText('Campaign start date (optional)')).toBeInTheDocument();

    await user.click(within(form).getByRole('button', { name: 'Send request' }));
    expect(within(form).getByText('Enter your full name.')).toBeInTheDocument();
    expect(api.submitBookingRequest).not.toHaveBeenCalled();

    await user.click(within(form).getByRole('button', { name: 'Event hosting' }));
    expect(router.state.location.search).toBe('');
    await user.type(within(form).getByRole('textbox', { name: 'Full name' }), 'Marie Joseph');
    await user.type(within(form).getByRole('textbox', { name: 'Email' }), 'marie@example.com');
    await user.type(within(form).getByRole('textbox', { name: /Tell us about/ }), 'Gala in Miami');
    await user.click(within(form).getByRole('button', { name: 'Send request' }));

    expect(api.submitBookingRequest).toHaveBeenCalledWith(expect.objectContaining({ requestType: 'Event hosting', fullName: 'Marie Joseph', languages: ['English', 'Kreyòl'] }));
    expect(await screen.findByText('JR-2601')).toBeInTheDocument();
  });
});

describe('donation form', () => {
  it('preselects the amount from the link and never collects card details', async () => {
    const user = userEvent.setup();
    renderAt('/support?amount=50');
    const form = await screen.findByRole('form', { name: 'Make a gift' });
    expect(within(form).getByRole('button', { name: 'Pledge $51.50 monthly' })).toBeInTheDocument();
    expect(within(form).queryByPlaceholderText(/card number/i)).not.toBeInTheDocument();

    await user.type(within(form).getByRole('textbox', { name: 'Email for receipt' }), 'marie@example.com');
    await user.click(within(form).getByRole('button', { name: 'One time' }));
    await user.click(within(form).getByRole('button', { name: 'Pledge $51.50' }));
    expect(api.submitPledge).toHaveBeenCalledWith(expect.objectContaining({ kind: 'donation', frequency: 'once', amountCents: 5000, coverFees: true, tier: null }));
    await waitFor(() => expect(screen.getByText(/no money was taken/)).toBeInTheDocument());
  });
});
