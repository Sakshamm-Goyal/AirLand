import path from 'node:path';
import { type Browser, expect, type Page, test } from '@playwright/test';

/**
 * Two real users in two isolated browser sessions, driving the actual UI against the actual API:
 * sign-up → list land with a photo → buyer finds it → chat both ways → video call accept/end →
 * decline with quick reply → missed call → owner edits and marks sold.
 */

const run = Date.now().toString(36);
// Names are letters only, so the run id goes in the email, not the name.
const seller = { name: 'Ravi Seller', email: `seller.${run}@e2e.test` };
const buyer = { name: 'Meera Buyer', email: `buyer.${run}@e2e.test` };
const title = `E2E mango farm ${run}`;
const PHOTO = path.join(__dirname, '../apps/mobile/assets/images/icon.png');

/** Newest 6-digit code mailed to this address, read from the local Mailpit inbox (docker compose `mail`). */
async function mailedCode(to: string, subject: RegExp) {
  const url = `${process.env.MAILPIT_URL ?? 'http://localhost:8025'}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`;
  for (let i = 0; i < 30; i++) {
    const { messages } = (await (await fetch(url)).json()) as { messages: { Subject: string }[] };
    const hit = messages.find((m) => subject.test(m.Subject));
    if (hit) return hit.Subject.match(/\d{6}/)![0];
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email to ${to} matching ${subject}`);
}

/** Expo's dev-server error toast is an overlay outside the app; keep it from covering real buttons. */
const HIDE_DEV_OVERLAY = '#error-toast { display: none !important; }';

async function newUser(browser: Browser, who: { name: string; email: string }, role: 'Buyer' | 'Seller') {
  const ctx = await browser.newContext();
  await ctx.addInitScript((css) => {
    document.addEventListener('DOMContentLoaded', () => {
      const el = document.createElement('style');
      el.textContent = css;
      document.head.append(el);
    });
  }, HIDE_DEV_OVERLAY);
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByRole('radio', { name: new RegExp(role) }).click();
  await page.getByLabel('Full name').fill(who.name);
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  // Sign-up mails a code and asks for it. Sellers enter it; buyers skip and get a reminder banner instead.
  await expect(page.getByText('Check your email')).toBeVisible();
  if (role === 'Seller') {
    await page.getByLabel('Verification code').fill(await mailedCode(who.email, /is your LandConnect code/));
    await expect(page.getByLabel('Search listings')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verify your email' })).toHaveCount(0);
  } else {
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('button', { name: 'Verify your email' })).toBeVisible();
  }
  return page;
}

const visible = (page: Page, text: string | RegExp, timeout?: number) => expect(page.getByText(text).last()).toBeVisible({ timeout });

test.describe.configure({ mode: 'serial' });

let s: Page;
let b: Page;

test('sign-up shows inline validation, including RERA for brokers', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByRole('radio', { name: /Broker/ }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await visible(page, 'Enter your name');
  await visible(page, 'Brokers need a RERA registration number');
});

test('seller and buyer sign up; only the seller can list land', async ({ browser }) => {
  s = await newUser(browser, seller, 'Seller');
  b = await newUser(browser, buyer, 'Buyer');
  await expect(s.getByRole('button', { name: 'List land' })).toBeVisible();
  await expect(b.getByRole('button', { name: 'List land' })).toHaveCount(0);
  // Tab bar sits at the bottom of the screen, like the Android app.
  const tab = await b.getByRole('tab', { name: 'Explore' }).boundingBox();
  expect(tab?.y).toBeGreaterThan((b.viewportSize()?.height ?? 0) - 120);
});

test('seller lists land with a photo, price preview and location', async () => {
  await s.getByRole('button', { name: 'List land' }).click();
  const chooser = s.waitForEvent('filechooser');
  await s.getByRole('button', { name: 'Add photos' }).click();
  await (await chooser).setFiles(PHOTO);
  await s.getByLabel('Title').fill(title);
  await s.getByLabel('Size').fill('2.5');
  await s.getByLabel('Asking price (₹)').fill('11200000');
  await visible(s, /₹ 1\.12 Cr · ₹ 44\.8 L \/ acre/);
  await s.getByLabel('Village / locality').fill('Chevella');
  await expect(s.getByRole('button', { name: 'Publish listing' })).toBeEnabled({ timeout: 30_000 }); // photo uploaded
  await s.getByRole('button', { name: 'Publish listing' }).click();
  await visible(s, 'Your land is live');
  await visible(s, title);
  await expect(s.getByRole('button', { name: 'Edit' })).toBeVisible();
});

test('buyer finds the listing by search, sees no phone number, and starts a chat', async () => {
  await b.getByLabel('Search listings').fill(run);
  await b
    .getByRole('button', { name: new RegExp(`^${title}`) })
    .first()
    .click();
  await visible(b, 'Phone hidden');
  await b.getByRole('button', { name: 'Save', exact: true }).click();
  // The seller's contact details must never reach the buyer (the buyer's own email is on their Profile tab).
  await expect(b.getByText(seller.email)).toHaveCount(0);
  await b.getByRole('button', { name: 'Chat' }).click();
  await visible(b, /Phone numbers stay hidden/);
  await b.getByLabel('Message').fill('Is the price negotiable?');
  await b.getByRole('button', { name: 'Send' }).click();
  await visible(b, 'Is the price negotiable?');
});

test('seller sees the enquiry live and replies', async () => {
  await s.goto('/chats');
  await visible(s, buyer.name);
  await visible(s, title);
  await s.getByText(buyer.name).click();
  await visible(s, 'Is the price negotiable?');
  await s.getByLabel('Message').fill('Yes, a little. Come on Saturday.');
  await s.getByRole('button', { name: 'Send' }).click();
  await visible(b, 'Yes, a little. Come on Saturday.');
});

test('video call: ring, accept, connected on both sides, end, call bubble', async () => {
  await b.getByRole('button', { name: `Video call ${seller.name}` }).click();
  await visible(b, 'Ringing…');
  await visible(s, /Incoming video call/);
  await visible(s, 'Number hidden');
  await s.getByRole('button', { name: 'Accept' }).click();
  await expect(s.getByRole('button', { name: 'End call' })).toBeVisible();
  await expect(b.getByRole('button', { name: 'End call' })).toBeVisible();
  await b.waitForTimeout(2500);
  await b.getByRole('button', { name: 'End call' }).click();
  await visible(b, /Video call · 0:0\d/);
  await visible(s, /Video call · 0:0\d/);
});

test('decline with a quick reply: caller is told and gets the message', async () => {
  await b.getByRole('button', { name: `Voice call ${seller.name}` }).click();
  await visible(s, /Incoming voice call/);
  await s.getByText('Reply with a message').click();
  await s.getByText("Can't talk now. I'll call you back.").click();
  await visible(b, 'Call declined');
  await visible(b, 'Voice call declined');
  await visible(b, "Can't talk now. I'll call you back.");
});

test('unanswered call becomes a missed call after 30 s', async () => {
  test.setTimeout(90_000);
  await b.getByRole('button', { name: `Voice call ${seller.name}` }).click();
  await visible(s, /Incoming voice call/);
  await visible(b, 'No answer', 45_000);
  await visible(b, 'Missed voice call');
  await visible(s, 'Missed voice call');
  await expect(s.getByRole('button', { name: 'Accept' })).toHaveCount(0);
});

test('call log lists every outcome', async () => {
  await b.goto('/calls');
  await visible(b, 'Answered');
  await visible(b, 'Declined');
  await visible(b, 'Missed');
});

test('owner edits the listing and marks it sold; it leaves the buyer feed', async () => {
  await s.goto('/profile');
  await s.getByRole('button', { name: title }).click();
  await s.getByRole('button', { name: 'Edit' }).click();
  await s.getByLabel('Title').fill(`${title} (price reduced)`);
  await s.getByRole('button', { name: 'Save changes' }).click();
  await visible(s, 'Listing updated');
  await visible(s, `${title} (price reduced)`);
  await s.getByRole('button', { name: 'Mark sold' }).click();
  await expect(s.getByRole('button', { name: 'Mark available' })).toBeVisible();

  await b.goto('/explore');
  await b.getByLabel('Search listings').fill(run);
  await visible(b, 'No land matches');
  // …but the buyer's Saved list keeps it, marked Sold.
  await b.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(b.getByRole('button', { name: new RegExp(`^${title} \\(price reduced\\)`) })).toBeVisible();
  await visible(b, 'Sold');
});

test('forgot password: emailed code sets a new password and signs in', async () => {
  await s.goto('/profile');
  await s.getByRole('button', { name: 'Sign out' }).click();
  await s.goto('/sign-in');
  await s.getByText('Forgot password?').click();
  await visible(s, /send a 6-digit code to reset it/);
  await s.getByLabel('Email').last().fill(seller.email);
  await s.getByRole('button', { name: 'Send code' }).click();
  await s.getByLabel('Verification code').fill(await mailedCode(seller.email, /resets your LandConnect password/));
  await s.getByRole('textbox', { name: 'New password' }).fill('a-new-password-1');
  await s.getByRole('button', { name: 'Reset password' }).click();
  await expect(s.getByLabel('Search listings')).toBeVisible();
});
