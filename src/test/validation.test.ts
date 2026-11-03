import { describe, expect, it } from 'vitest';
import {
  ageOn,
  isEmail,
  sameName,
  validateBooking,
  validateGuest,
  validateNewsletter,
  validatePledge,
  validateRelease,
  type BookingInput,
  type ReleaseInput,
} from '../lib/validation';

const TODAY = new Date(2026, 10, 3); // 3 Nov 2026, local time

const booking: BookingInput = {
  requestType: 'Event hosting', fullName: 'Marie Joseph', organization: '', email: 'marie@example.com', phone: '', eventDate: '',
  venue: '', audience: '100–500', campaignStart: '', product: '', languages: ['Kreyòl'], budget: '$2.5k–$10k', message: 'Gala on Dec 12',
};

const release: ReleaseInput = {
  legalName: 'Marie Joseph', screenName: 'Dr. Marie Joseph', email: 'marie@example.com', phone: '(305) 555-0100', address: '1 Main St, Miami, FL',
  dateOfBirth: '1990-04-02', episode: 'EP 49', recordingDate: '2026-11-10', isMinor: false, guardianName: '', guardianRelationship: '',
  consents: [true, true, true, true], signature: 'marie  JOSEPH',
};

describe('basic checks', () => {
  it('accepts normal emails and rejects malformed ones', () => {
    expect(isEmail('a.b@example.co')).toBe(true);
    expect(isEmail(' spaced@example.com ')).toBe(true);
    expect(isEmail('no-at.example.com')).toBe(false);
    expect(isEmail('x@y')).toBe(false);
  });

  it('compares names ignoring case, outer and repeated spaces, and keeps accents', () => {
    expect(sameName('  Jean-Rènel   Pierre ', 'jean-rènel pierre')).toBe(true);
    expect(sameName('Jean Renel', 'Jean Rènel')).toBe(false);
    expect(sameName('', '')).toBe(false);
  });

  it('computes age on a given day', () => {
    expect(ageOn('2008-11-03', TODAY)).toBe(18);
    expect(ageOn('2008-11-04', TODAY)).toBe(17);
  });
});

describe('newsletter', () => {
  it('requires an email and at least one alert', () => {
    const errs = validateNewsletter({ email: '', language: 'Kreyòl', alerts: { premiere: false, briefing: false, breaking: false } });
    expect(errs.email).toBeDefined();
    expect(errs.alerts).toBeDefined();
    expect(validateNewsletter({ email: 'a@b.co', language: 'Kreyòl', alerts: { premiere: true, briefing: false, breaking: false } })).toEqual({});
  });
});

describe('booking request', () => {
  it('passes a complete request', () => {
    expect(validateBooking(booking, TODAY)).toEqual({});
  });

  it('flags missing name, email and details', () => {
    const errs = validateBooking({ ...booking, fullName: ' ', email: '', message: '' }, TODAY);
    expect(Object.keys(errs).sort()).toEqual(['email', 'fullName', 'message']);
  });

  it('rejects past event dates but checks the campaign date for ads', () => {
    expect(validateBooking({ ...booking, eventDate: '2026-11-02' }, TODAY).eventDate).toMatch(/passed/);
    expect(validateBooking({ ...booking, eventDate: '2026-11-03' }, TODAY)).toEqual({});
    const ad = { ...booking, requestType: 'Advertising' as const, eventDate: '2020-01-01', campaignStart: '2026-02-30' };
    const errs = validateBooking(ad, TODAY);
    expect(errs.eventDate).toBeUndefined();
    expect(errs.campaignStart).toBe('Enter a valid date.');
  });

  it('needs at least one language', () => {
    expect(validateBooking({ ...booking, languages: [] }, TODAY).languages).toBeDefined();
  });
});

describe('guest request', () => {
  it('requires a pitch and a valid phone when given', () => {
    const errs = validateGuest({ fullName: 'A', titleOrg: '', email: 'a@b.co', phone: '12', topic: 'Haiti', languages: ['English'], format: 'One-on-one interview', links: '', pitch: '' });
    expect(errs.phone).toBeDefined();
    expect(errs.pitch).toBeDefined();
  });
});

describe('talent release', () => {
  it('accepts a signature that matches the legal name', () => {
    expect(validateRelease(release, TODAY)).toEqual({});
  });

  it('requires every field and all four consents', () => {
    const empty: ReleaseInput = { ...release, legalName: '', screenName: '', email: '', phone: '', address: '', dateOfBirth: '', episode: '', recordingDate: '', consents: [true, false, true, true], signature: '' };
    const errs = validateRelease(empty, TODAY);
    expect(Object.keys(errs).sort()).toEqual(['address', 'consents', 'dateOfBirth', 'email', 'episode', 'legalName', 'phone', 'recordingDate', 'screenName', 'signature']);
  });

  it('sends a minor to the guardian path and expects the guardian to sign', () => {
    const minor = { ...release, dateOfBirth: '2012-05-04' };
    expect(validateRelease(minor, TODAY).dateOfBirth).toMatch(/under 18/);
    const withGuardian = { ...minor, isMinor: true, guardianName: 'Rose Joseph', guardianRelationship: 'Mother' };
    expect(validateRelease(withGuardian, TODAY).signature).toMatch(/parent or guardian/);
    expect(validateRelease({ ...withGuardian, signature: 'Rose Joseph' }, TODAY)).toEqual({});
  });

  it('rejects a signature that is not the signer’s name', () => {
    expect(validateRelease({ ...release, signature: 'Someone Else' }, TODAY).signature).toBeDefined();
  });
});

describe('support pledge', () => {
  const base = { kind: 'donation' as const, frequency: 'monthly' as const, amountCents: 2500, coverFees: true, method: 'Card' as const, tier: 'Insider', fullName: '', email: 'a@b.co', agreed: true };

  it('accepts a donation without a name', () => {
    expect(validatePledge(base)).toEqual({});
  });

  it('enforces amount bounds', () => {
    expect(validatePledge({ ...base, amountCents: 0 }).amountCents).toBeDefined();
    expect(validatePledge({ ...base, amountCents: 100_000_01 }).amountCents).toBeDefined();
  });

  it('requires a name and agreement for VIP', () => {
    const errs = validatePledge({ ...base, kind: 'vip', amountCents: 4599, agreed: false });
    expect(errs.fullName).toBeDefined();
    expect(errs.agreed).toBeDefined();
  });
});
