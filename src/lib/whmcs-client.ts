import type { WHMCSConfig, DomainCheckResponse, WHMCSAuthResponse, WHMCSTicketsResponse } from '@/types/whmcs';

export class WHMCSClient {
  private config: WHMCSConfig;

  constructor(config: WHMCSConfig) {
    this.config = config;
  }

  private async makeRequest<T>(action: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.config.url}/includes/api.php`);

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
      throw new Error(`WHMCS API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async checkDomainAvailability(domains: string[]): Promise<DomainCheckResponse> {
    const domainString = domains.join(',');

    return this.makeRequest<DomainCheckResponse>('DomainWhois', {
      domain: domainString,
    });
  }

  async getDomainPricing(tld: string): Promise<any> {
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

  async getClientDetails(clientId: string, email?: string, password?: string): Promise<any> {
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
    priority: 'Low' | 'Medium' | 'High' = 'Medium'
  ): Promise<any> {
    return this.makeRequest('OpenTicket', {
      clientid: clientId,
      deptid: deptId,
      subject,
      message,
      priority,
    });
  }

  async addClient(clientData: Record<string, string>): Promise<any> {
    return this.makeRequest('AddClient', clientData);
  }

  async getOrders(clientId: string): Promise<any> {
    return this.makeRequest('GetOrders', {
      clientid: clientId,
      limitnum: '25',
    });
  }

  async getInvoices(clientId: string): Promise<any> {
    return this.makeRequest('GetInvoices', {
      clientid: clientId,
      limitnum: '25',
    });
  }
}
