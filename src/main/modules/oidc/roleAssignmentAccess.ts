import type { RoleAssignment } from '../role-assignment/roleAssignmentClient';

export const WA_REPORTING_AUTHORIZATION_SESSION_KEY = 'waReportingAuthorization';

export interface WaReportingAuthorization {
  source: 'idam' | 'role-assignment';
  roleName?: string;
  checkedAt: string;
}

interface WaReportingSession {
  [WA_REPORTING_AUTHORIZATION_SESSION_KEY]?: WaReportingAuthorization;
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const parseRoleAssignmentRoleNames = (value: string): string[] =>
  value
    .split(',')
    .map(roleName => roleName.trim())
    .filter(roleName => roleName.length > 0);

const parseBoundaryTime = (value: string | null | undefined): number | null => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  if (value.trim().length === 0) {
    return Number.NaN;
  }

  return Date.parse(value);
};

export const isActiveRoleAssignment = (assignment: RoleAssignment, now: Date = new Date()): boolean => {
  const beginTime = parseBoundaryTime(assignment.beginTime);
  const endTime = parseBoundaryTime(assignment.endTime);

  if (Number.isNaN(beginTime) || Number.isNaN(endTime)) {
    return false;
  }

  const currentTime = now.getTime();
  return (beginTime === null || beginTime <= currentTime) && (endTime === null || endTime >= currentTime);
};

export const findActiveRoleAssignment = (
  assignments: RoleAssignment[],
  allowedRoleNames: string[],
  now: Date = new Date()
): RoleAssignment | undefined => {
  const allowedRoleNameSet = new Set(allowedRoleNames);
  return assignments.find(
    assignment =>
      typeof assignment.roleName === 'string' &&
      allowedRoleNameSet.has(assignment.roleName) &&
      isActiveRoleAssignment(assignment, now)
  );
};

export const buildWaReportingAuthorization = (
  source: WaReportingAuthorization['source'],
  roleName?: string
): WaReportingAuthorization => ({
  source,
  ...(roleName ? { roleName } : {}),
  checkedAt: new Date().toISOString(),
});

export const hasRoleAssignmentAuthorization = (session: unknown): boolean => {
  const authorization = (session as WaReportingSession | undefined)?.[WA_REPORTING_AUTHORIZATION_SESSION_KEY];
  return (
    authorization?.source === 'role-assignment' &&
    isNonEmptyString(authorization.roleName) &&
    isNonEmptyString(authorization.checkedAt) &&
    !Number.isNaN(Date.parse(authorization.checkedAt))
  );
};
