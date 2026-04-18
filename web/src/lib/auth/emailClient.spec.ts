import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMagicLink } from './emailClient';

type EmailRequestPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
};

const testParams = {
  to: 'captain@example.com',
  magicLinkUrl: 'https://rydercup.sbcctears.com/manage/consume?token=test-token',
  expiresAt: new Date('2026-04-17T12:15:00.000Z'),
  resendApiKey: 'test-key',
  fromEmail: 'Ryder Cup <noreply@mail.rydercup.sbcctears.com>',
} as const;

function assertRequestPayload(requestInit: RequestInit | undefined): EmailRequestPayload {
  if (!requestInit?.body || typeof requestInit.body !== 'string') {
    throw new Error('Expected request body to be a JSON string.');
  }

  return JSON.parse(requestInit.body) as EmailRequestPayload;
}

describe('sendMagicLink', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a Resend email with expected request shape on success', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'email_123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(sendMagicLink({ ...testParams })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    const payload = assertRequestPayload(requestInit);
    const headers = new Headers(requestInit?.headers);

    expect(requestUrl).toBe('https://api.resend.com/emails');
    expect(requestInit?.method).toBe('POST');
    expect(headers.get('Authorization')).toBe('Bearer test-key');
    expect(payload.to).toEqual(['captain@example.com']);
    expect(payload.subject).toBe('Your Ryder Cup sign-in link');
    expect(payload.html).toContain(testParams.magicLinkUrl);
  });

  it('throws an error that includes status code when Resend returns non-2xx', async () => {
    fetchMock.mockResolvedValue(new Response('invalid recipient', { status: 422 }));

    await expect(sendMagicLink({ ...testParams })).rejects.toThrow(/422/u);
  });
});
