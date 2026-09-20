export interface WHMCSConfig {
  url: string;
  apiIdentifier: string;
  apiSecret: string;
}

/** Raw response of the WHMCS `DomainWhois` API, which checks one domain per call. */
export interface DomainWhoisResponse {
  result: 'success' | 'error';
  status?: 'available' | 'unavailable';
  whois?: string;
  message?: string;
}

export type DomainAvailability = 'available' | 'unavailable' | 'error';

export interface DomainCheckResult {
  domain: string;
  status: DomainAvailability;
  message?: string;
}

/** Shape returned by /api/domains/check. */
export interface DomainCheckResponse {
  result: 'success' | 'error';
  domains: DomainCheckResult[];
  message?: string;
}

export interface WHMCSClientDetails {
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
  userAgent?: string | null;
  country?: string | null;
  available: boolean;
}
