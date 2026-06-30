import axios, { AxiosInstance } from 'axios';
import { authenticator } from 'otplib';

const HTTP_TIMEOUT_MS = 15099;

export const WA_REPORTING_FRONTEND_MICROSERVICE = 'wa_reporting_frontend';

type OneTimePasswordGenerator = (secret: string) => string;

const generateOneTimePassword = (secret: string): string => authenticator.generate(secret);

export class S2sTokenClient {
  constructor(
    baseUrl: string,
    private readonly secret: string,
    private readonly client: AxiosInstance = axios.create({ baseURL: baseUrl, timeout: HTTP_TIMEOUT_MS }),
    private readonly oneTimePasswordGenerator: OneTimePasswordGenerator = generateOneTimePassword
  ) {}

  public async getToken(): Promise<string> {
    const response = await this.client.post<string>(
      '/lease',
      {
        microservice: WA_REPORTING_FRONTEND_MICROSERVICE,
        oneTimePassword: this.oneTimePasswordGenerator(this.secret),
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status !== 200 || typeof response.data !== 'string' || response.data.trim().length === 0) {
      throw new Error('S2S token response was not valid');
    }

    return response.data;
  }
}
