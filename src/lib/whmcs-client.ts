import type {
  WHMCSConfig,
  DomainWhoisResponse,
  DomainCheckResult,
  WHMCSAuthResponse,
  WHMCSTicketsResponse,
} from '@/types/whmcs';

/**
 * Server-side WHMCS API client. Only ever instantiated inside Pages Functions;
 * the identifier and secret must not reach the browser.
 */
export class WHMCSClient {
  private config: WHMCSConfig;

  constructor(config: WHMCSConfig) {
    this.config = config;
  }

  private async makeRequest<T>(action: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL('/includes/api.php', this.config.url);

    const body = new URLSearchParams({
      action,
      identifier: this.config.apiIdentifier,
      secret: this.config.apiSecret,
      responsetype: 'json',
      ...params,
    });

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`WHMCS API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /** WHMCS `DomainWhois` checks a single domain per call. */
  async checkDomain(domain: string): Promise<DomainWhoisResponse> {
    return this.makeRequest<DomainWhoisResponse>('DomainWhois', { domain });
  }

  /** Check several domains in parallel. A failed lookup becomes status "error" rather than rejecting the batch. */
  async checkDomains(domains: string[]): Promise<DomainCheckResult[]> {
    return Promise.all(
      domains.map(async (domain): Promise<DomainCheckResult> => {
        try {
          const res = await this.checkDomain(domain);
          if (res.result !== 'success') {
            return { domain, status: 'error', message: res.message };
          }
          if (res.status === 'available' || res.status === 'unavailable') {
            return { domain, status: res.status };
          }
          return { domain, status: 'error', message: 'Unexpected response' };
        } catch (error) {
          return { domain, status: 'error', message: error instanceof Error ? error.message : 'Lookup failed' };
        }
      }),
    );
  }

  async getTldPricing(): Promise<unknown> {
    return this.makeRequest('GetTLDPricing', {
      currencyid: '1',
    });
  }

  async validateLogin(email: string, password: string): Promise<WHMCSAuthResponse> {
    return this.makeRequest<WHMCSAuthResponse>('ValidateLogin', {
      email,
      password2: password,
    });
  }

  async getClientDetails(clientId: string, email?: string, password?: string): Promise<unknown> {
    const params: Record<string, string> = {};

    if (clientId) {
      params.clientid = clientId;
    }
    if (email && password) {
      params.email = email;
      params.password2 = password;
    }

    return this.makeRequest('GetClientsDetails', params);
  }

  async getClientTickets(clientId: string): Promise<WHMCSTicketsResponse> {
    return this.makeRequest<WHMCSTicketsResponse>('GetTickets', {
      clientid: clientId,
      limitnum: '25',
    });
  }

  async openTicket(
    clientId: string,
    deptId: string,
    subject: string,
    message: string,
    priority: 'Low' | 'Medium' | 'High' = 'Medium',
  ): Promise<{ result: 'success' | 'error'; message?: string; id?: string; tid?: string }> {
    return this.makeRequest('OpenTicket', {
      clientid: clientId,
      deptid: deptId,
      subject,
      message,
      priority,
    });
  }

  async addClient(clientData: Record<string, string>): Promise<unknown> {
    return this.makeRequest('AddClient', clientData);
  }

  async getOrders(clientId: string): Promise<unknown> {
    return this.makeRequest('GetOrders', {
      clientid: clientId,
      limitnum: '25',
    });
  }

  async getInvoices(clientId: string): Promise<unknown> {
    return this.makeRequest('GetInvoices', {
      clientid: clientId,
      limitnum: '25',
    });
  }
}
