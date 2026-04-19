import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMagicLink } from './emailClient';

type EmailRequestPayload = {
  api_key: string;
  sender: string;
  to: string[];
  subject: string;
  html_body: string;
  text_body: string;
};

const testParams = {
  to: 'captain@example.com',
  magicLinkUrl: 'https://golf.sbcctears.com/manage/consume?token=test-token',
  expiresAt: new Date('2026-04-17T12:15:00.000Z'),
  emailApiKey: 'test-key',
  fromEmail: 'SBCC Tears <michael@sbcctears.com>',
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

  it('sends an smtp2go email with expected request shape on success', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ request_id: 'email_123', data: { succeeded: 1 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(sendMagicLink({ ...testParams })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    const payload = assertRequestPayload(requestInit);
    const headers = new Headers(requestInit?.headers);

    expect(requestUrl).toBe('https://api.smtp2go.com/v3/email/send');
    expect(requestInit?.method).toBe('POST');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(payload.api_key).toBe('test-key');
    expect(payload.sender).toBe('SBCC Tears <michael@sbcctears.com>');
    expect(payload.to).toEqual(['captain@example.com']);
    expect(payload.subject).toBe('Your Kiawah Golf sign-in link');
    expect(payload.html_body).toContain(testParams.magicLinkUrl);
  });

  it('throws an error that includes status code when smtp2go returns non-2xx', async () => {
    fetchMock.mockResolvedValue(new Response('invalid recipient', { status: 422 }));

    await expect(sendMagicLink({ ...testParams })).rejects.toThrow(/422/u);
  });
});
