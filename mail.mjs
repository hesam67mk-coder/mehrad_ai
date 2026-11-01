// Server-only transactional email. Never import this module from the browser.
export function createMailer(env = process.env) {
  const test = env.NODE_ENV === 'test' && env.MAIL_TEST_URL;
  const endpoint = test || 'https://api.resend.com/emails';
  if (test && !['127.0.0.1','localhost','[::1]'].includes(new URL(test).hostname)) throw Error('Mail test endpoint must be loopback');
  const configured = Boolean(test || (env.RESEND_API_KEY && env.MAIL_FROM));
  return {
    configured,
    async send(message, id) {
      if (!configured) throw Error('MAIL_NOT_CONFIGURED');
      const response = await fetch(endpoint, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: {'Content-Type':'application/json', Authorization:`Bearer ${test?'test-only':env.RESEND_API_KEY}`, 'Idempotency-Key':id},
        body: JSON.stringify({from:env.MAIL_FROM || 'test@example.test', ...message})
      });
      if (!response.ok) throw Error(`MAIL_PROVIDER_${response.status}`);
      const result = await response.json();
      if (!result.id) throw Error('MAIL_INVALID_RESPONSE');
    }
  };
}
