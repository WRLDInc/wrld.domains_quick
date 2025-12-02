import { WHMCSClient } from '../../../src/lib/whmcs-client';

interface Env extends CloudflareEnv {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { name, email, subject, message } = await context.request.json() as {
      name: string;
      email: string;
      subject: string;
      message: string;
    };

    if (!name || !email || !subject || !message) {
      return new Response(JSON.stringify({
        result: 'error',
        message: 'All fields are required',
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

    // For guest tickets, we'll use a specific department ID
    // You'll need to configure this based on your WHMCS setup
    const result = await whmcsClient.openTicket(
      '0', // Guest ticket
      '1', // Department ID - adjust based on your WHMCS
      subject,
      `From: ${name} (${email})\n\n${message}`,
      'Medium'
    );

    return new Response(JSON.stringify(result), {
      status: result.result === 'success' ? 200 : 400,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Ticket submission error:', error);

    return new Response(JSON.stringify({
      result: 'error',
      message: 'Failed to submit ticket',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
