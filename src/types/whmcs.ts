export interface WHMCSConfig {
  url: string;
  apiIdentifier: string;
  apiSecret: string;
}

export interface DomainCheckResult {
  domain: string;
  status: 'available' | 'unavailable' | 'error';
  price?: string;
  period?: string;
}

export interface DomainCheckResponse {
  result: 'success' | 'error';
  domains: Record<string, DomainCheckResult>;
  message?: string;
}

export interface WHMCSClient {
  email: string;
  firstname: string;
  lastname: string;
  companyname?: string;
  address1: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phonenumber: string;
}

export interface WHMCSAuthResponse {
  result: 'success' | 'error';
  clientid?: string;
  token?: string;
  message?: string;
}

export interface WHMCSTicket {
  id: string;
  tid: string;
  subject: string;
  status: string;
  date: string;
  lastreply: string;
}

export interface WHMCSTicketsResponse {
  result: 'success' | 'error';
  tickets: {
    ticket: WHMCSTicket[];
  };
  message?: string;
}

export interface DomainAnalytics {
  domain: string;
  timestamp: string;
  userAgent?: string;
  country?: string;
  available: boolean;
}
