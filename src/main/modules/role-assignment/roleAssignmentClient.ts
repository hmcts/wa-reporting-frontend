import axios, { AxiosInstance } from 'axios';

import { S2sTokenClient } from '../s2s/s2sTokenClient';

const HTTP_TIMEOUT_MS = 15099;

export interface RoleAssignment {
  roleName?: string;
  beginTime?: string | null;
  endTime?: string | null;
}

interface RoleAssignmentResource {
  roleAssignmentResponse?: RoleAssignment[];
}

export class RoleAssignmentClient {
  constructor(
    baseUrl: string,
    private readonly s2sTokenClient: S2sTokenClient,
    private readonly client: AxiosInstance = axios.create({ baseURL: baseUrl, timeout: HTTP_TIMEOUT_MS })
  ) {}

  public async getAssignmentsForActor(actorId: string, userAccessToken: string): Promise<RoleAssignment[]> {
    const serviceToken = await this.s2sTokenClient.getToken();
    const response = await this.client.get<RoleAssignmentResource>(
      `/am/role-assignments/actors/${encodeURIComponent(actorId)}`,
      {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          ServiceAuthorization: `Bearer ${serviceToken}`,
        },
      }
    );

    if (response.status !== 200 || !Array.isArray(response.data?.roleAssignmentResponse)) {
      throw new Error('Role assignment response was not valid');
    }

    return response.data.roleAssignmentResponse;
  }
}
