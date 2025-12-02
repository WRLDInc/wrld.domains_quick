import { WHMCSClient } from '../../../src/lib/whmcs-client';

interface Env extends CloudflareEnv {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { email, password } = await context.request.json() as { email: string; password: string };

    if (!email || !password) {
      return new Response(JSON.stringify({
        result: 'error',
        message: 'Email and password are required',
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

    const result = await whmcsClient.validateLogin(email, password);

    return new Response(JSON.stringify(result), {
      status: result.result === 'success' ? 200 : 401,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    return new Response(JSON.stringify({
      result: 'error',
      message: 'Authentication failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
