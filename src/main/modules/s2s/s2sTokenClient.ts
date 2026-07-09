import axios, { AxiosInstance } from 'axios';
import { createGuardrails, generateSync } from 'otplib';

const HTTP_TIMEOUT_MS = 15099;
const S2S_OTP_GUARDRAILS = createGuardrails({ MIN_SECRET_BYTES: 10 });

export const WA_REPORTING_FRONTEND_MICROSERVICE = 'wa_reporting_frontend';

type OneTimePasswordGenerator = (secret: string) => string;

// Otplib v12 accepted HMCTS 16-character Base32 S2S secrets, which decode to 10 bytes.
const generateOneTimePassword = (secret: string): string => generateSync({ secret, guardrails: S2S_OTP_GUARDRAILS });

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
