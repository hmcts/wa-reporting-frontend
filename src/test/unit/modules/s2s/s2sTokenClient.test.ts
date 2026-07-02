import type { AxiosInstance } from 'axios';
import axios from 'axios';

import { S2sTokenClient, WA_REPORTING_FRONTEND_MICROSERVICE } from '../../../../main/modules/s2s/s2sTokenClient';

describe('S2sTokenClient', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('creates an axios client and generates an S2S one-time password when dependencies are not injected', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-02T03:04:05.000Z'));
    const post = jest.fn().mockResolvedValue({ status: 200, data: 'service-token' });
    jest.spyOn(axios, 'create').mockReturnValue({ post } as unknown as AxiosInstance);

    const client = new S2sTokenClient('http://s2s', 'AAAAAAAAAAAAAAAA');

    await expect(client.getToken()).resolves.toBe('service-token');

    expect(axios.create).toHaveBeenCalledWith({ baseURL: 'http://s2s', timeout: 15099 });
    expect(post).toHaveBeenCalledWith(
      '/lease',
      {
        microservice: WA_REPORTING_FRONTEND_MICROSERVICE,
        oneTimePassword: '405911',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  });

  it('requests a service token with the configured microservice and generated one-time password', async () => {
    const post = jest.fn().mockResolvedValue({ status: 200, data: 'service-token' });
    const client = new S2sTokenClient('http://s2s', 'secret', { post } as unknown as AxiosInstance, () => '123456');

    await expect(client.getToken()).resolves.toBe('service-token');

    expect(post).toHaveBeenCalledWith(
      '/lease',
      {
        microservice: WA_REPORTING_FRONTEND_MICROSERVICE,
        oneTimePassword: '123456',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  });

  it('rejects invalid token responses', async () => {
    const post = jest.fn().mockResolvedValue({ status: 200, data: { token: 'service-token' } });
    const client = new S2sTokenClient('http://s2s', 'secret', { post } as unknown as AxiosInstance, () => '123456');

    await expect(client.getToken()).rejects.toThrow('S2S token response was not valid');
  });

  it('rejects non-OK and blank token responses', async () => {
    const post = jest
      .fn()
      .mockResolvedValueOnce({ status: 201, data: 'service-token' })
      .mockResolvedValueOnce({ status: 200, data: '   ' });
    const client = new S2sTokenClient('http://s2s', 'secret', { post } as unknown as AxiosInstance, () => '123456');

    await expect(client.getToken()).rejects.toThrow('S2S token response was not valid');
    await expect(client.getToken()).rejects.toThrow('S2S token response was not valid');
  });

  it('propagates lease request failures', async () => {
    const post = jest.fn().mockRejectedValue(new Error('lease failed'));
    const client = new S2sTokenClient('http://s2s', 'secret', { post } as unknown as AxiosInstance, () => '123456');

    await expect(client.getToken()).rejects.toThrow('lease failed');
  });
});
