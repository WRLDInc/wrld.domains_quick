import { WHMCSClient } from '../../../src/lib/whmcs-client';

interface Env extends CloudflareEnv {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { domains } = await context.request.json() as { domains: string[] };

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return new Response(JSON.stringify({
        result: 'error',
        message: 'Invalid domains array',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const whmcsClient = new WHMCSClient({
      url: context.env.WHMCS_URL,
      apiIdentifier: context.env.WHMCS_API_IDENTIFIER,
      apiSecret: context.env.WHMCS_API_SECRET,
    });

    const result = await whmcsClient.checkDomainAvailability(domains);

    // Store analytics
    const timestamp = new Date().toISOString();
    for (const domain of domains) {
      const analyticsKey = `analytics:${domain}:${Date.now()}`;
      await context.env.DOMAIN_ANALYTICS.put(analyticsKey, JSON.stringify({
        domain,
        timestamp,
        userAgent: context.request.headers.get('user-agent'),
        country: context.request.headers.get('cf-ipcountry'),
        available: result.domains[domain]?.status === 'available',
      }), {
        expirationTtl: 60 * 60 * 24 * 90, // 90 days
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Domain check error:', error);

    return new Response(JSON.stringify({
      result: 'error',
      message: error instanceof Error ? error.message : 'Failed to check domains',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
