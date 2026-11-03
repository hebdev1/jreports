import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../lib/api';
import { clearResourceCache } from '../lib/resource';
import type { Episode } from '../lib/types';
import { routes } from '../router';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    fetchEpisodes: vi.fn(),
    fetchReports: vi.fn(async () => []),
    fetchArchive: vi.fn(async () => []),
    fetchSettings: vi.fn(async () => ({ ...actual.DEFAULT_SETTINGS, monthlyGoalCents: 1_200_000 })),
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

beforeEach(() => {
  clearResourceCache();
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
    vi.mocked(api.fetchEpisodes).mockRejectedValueOnce(new api.ApiError('network', 'We couldn’t reach the server.')).mockResolvedValue(EPISODES);
    const user = userEvent.setup();
    renderAt('/');
    const retry = (await screen.findAllByRole('button', { name: 'Try again' }))[0];
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
