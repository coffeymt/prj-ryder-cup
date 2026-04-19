const SMTP2GO_EMAILS_ENDPOINT = 'https://api.smtp2go.com/v3/email/send';
const MAGIC_LINK_SUBJECT = 'Your Tears Tourneys ⛳ sign-in link';
const ONE_MINUTE_MS = 60 * 1000;

type SendMagicLinkParams = {
  to: string;
  magicLinkUrl: string;
  expiresAt: Date;
  emailApiKey: string;
  fromEmail: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getExpiryLabel(expiresAt: Date): string {
  const minutesUntilExpiry = Math.max(
    1,
    Math.ceil((expiresAt.getTime() - Date.now()) / ONE_MINUTE_MS)
  );

  return minutesUntilExpiry === 1 ? '1 minute' : `${minutesUntilExpiry} minutes`;
}

function buildEmailContent(params: { magicLinkUrl: string; expiresAt: Date }): {
  html: string;
  text: string;
} {
  const expiryLabel = getExpiryLabel(params.expiresAt);
  const escapedMagicLinkUrl = escapeHtml(params.magicLinkUrl);

  return {
    html: [
      '<p>Your Tears Tourneys ⛳ sign-in link is ready.</p>',
      `<p><a href="${escapedMagicLinkUrl}">Click here to sign in</a> - link expires in ${expiryLabel}.</p>`,
      `<p>Plaintext fallback: ${escapedMagicLinkUrl}</p>`,
    ].join(''),
    text: [
      'Your Tears Tourneys ⛳ sign-in link is ready.',
      '',
      `Open this link to sign in (expires in ${expiryLabel}):`,
      params.magicLinkUrl,
    ].join('\n'),
  };
}

export async function sendMagicLink(params: SendMagicLinkParams): Promise<void> {
  const content = buildEmailContent({
    magicLinkUrl: params.magicLinkUrl,
    expiresAt: params.expiresAt,
  });

  const response = await fetch(SMTP2GO_EMAILS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: params.emailApiKey,
      sender: params.fromEmail,
      to: [params.to],
      subject: MAGIC_LINK_SUBJECT,
      html_body: content.html,
      text_body: content.text,
    }),
  });

  if (response.ok) {
    return;
  }

  const responseBody = await response.text();
  throw new Error(`smtp2go email send failed with status ${response.status}: ${responseBody}`);
}
