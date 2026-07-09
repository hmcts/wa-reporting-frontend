import type { AxiosInstance } from 'axios';
import axios from 'axios';

import { RoleAssignmentClient } from '../../../../main/modules/role-assignment/roleAssignmentClient';
import { S2sTokenClient } from '../../../../main/modules/s2s/s2sTokenClient';

describe('RoleAssignmentClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates an axios client when one is not injected', async () => {
    const getToken = jest.fn().mockResolvedValue('service-token');
    const get = jest.fn().mockResolvedValue({
      status: 200,
      data: {
        roleAssignmentResponse: [],
      },
    });
    jest.spyOn(axios, 'create').mockReturnValue({ get } as unknown as AxiosInstance);

    const client = new RoleAssignmentClient('http://ras', { getToken } as unknown as S2sTokenClient);

    await expect(client.getAssignmentsForActor('user-1', 'user-token')).resolves.toEqual([]);
    expect(axios.create).toHaveBeenCalledWith({ baseURL: 'http://ras', timeout: 15099 });
  });

  it('retrieves role assignments for an actor with user and service authorization headers', async () => {
    const getToken = jest.fn().mockResolvedValue('service-token');
    const get = jest.fn().mockResolvedValue({
      status: 200,
      data: {
        roleAssignmentResponse: [{ roleName: 'task-supervisor', beginTime: null, endTime: null }],
      },
    });
    const client = new RoleAssignmentClient(
      'http://ras',
      { getToken } as unknown as S2sTokenClient,
      { get } as unknown as AxiosInstance
    );

    await expect(client.getAssignmentsForActor('user 1', 'user-token')).resolves.toEqual([
      { roleName: 'task-supervisor', beginTime: null, endTime: null },
    ]);

    expect(get).toHaveBeenCalledWith('/am/role-assignments/actors/user%201', {
      headers: {
        Authorization: 'Bearer user-token',
        ServiceAuthorization: 'Bearer service-token',
      },
    });
  });

  it('rejects malformed role assignment responses', async () => {
    const getToken = jest.fn().mockResolvedValue('service-token');
    const get = jest.fn().mockResolvedValue({ status: 200, data: { roleAssignmentResponse: {} } });
    const client = new RoleAssignmentClient(
      'http://ras',
      { getToken } as unknown as S2sTokenClient,
      { get } as unknown as AxiosInstance
    );

    await expect(client.getAssignmentsForActor('user-1', 'user-token')).rejects.toThrow(
      'Role assignment response was not valid'
    );
  });

  it('rejects non-OK role assignment responses', async () => {
    const getToken = jest.fn().mockResolvedValue('service-token');
    const get = jest.fn().mockResolvedValue({ status: 204, data: { roleAssignmentResponse: [] } });
    const client = new RoleAssignmentClient(
      'http://ras',
      { getToken } as unknown as S2sTokenClient,
      { get } as unknown as AxiosInstance
    );

    await expect(client.getAssignmentsForActor('user-1', 'user-token')).rejects.toThrow(
      'Role assignment response was not valid'
    );
  });

  it('propagates role assignment request failures', async () => {
    const getToken = jest.fn().mockResolvedValue('service-token');
    const get = jest.fn().mockRejectedValue(new Error('ras failed'));
    const client = new RoleAssignmentClient(
      'http://ras',
      { getToken } as unknown as S2sTokenClient,
      { get } as unknown as AxiosInstance
    );

    await expect(client.getAssignmentsForActor('user-1', 'user-token')).rejects.toThrow('ras failed');
  });

  it('propagates S2S token failures without calling RAS', async () => {
    const getToken = jest.fn().mockRejectedValue(new Error('s2s failed'));
    const get = jest.fn();
    const client = new RoleAssignmentClient(
      'http://ras',
      { getToken } as unknown as S2sTokenClient,
      { get } as unknown as AxiosInstance
    );

    await expect(client.getAssignmentsForActor('user-1', 'user-token')).rejects.toThrow('s2s failed');
    expect(get).not.toHaveBeenCalled();
  });
});
