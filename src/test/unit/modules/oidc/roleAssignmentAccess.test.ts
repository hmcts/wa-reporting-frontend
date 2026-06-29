import {
  WA_REPORTING_AUTHORIZATION_SESSION_KEY,
  buildWaReportingAuthorization,
  findActiveRoleAssignment,
  hasRoleAssignmentAuthorization,
  isActiveRoleAssignment,
  parseRoleAssignmentRoleNames,
} from '../../../../main/modules/oidc/roleAssignmentAccess';

describe('roleAssignmentAccess', () => {
  const now = new Date('2026-06-28T12:00:00.000Z');

  it('parses comma-separated role names and ignores empty entries', () => {
    expect(parseRoleAssignmentRoleNames(' task-supervisor, judge, ,caseworker ')).toEqual([
      'task-supervisor',
      'judge',
      'caseworker',
    ]);
  });

  it('treats null begin and end times as open-ended', () => {
    expect(isActiveRoleAssignment({ roleName: 'task-supervisor', beginTime: null, endTime: null }, now)).toBe(true);
  });

  it('allows assignments whose time bounds include now', () => {
    expect(
      isActiveRoleAssignment(
        {
          roleName: 'task-supervisor',
          beginTime: '2026-06-28T12:00:00Z',
          endTime: '2026-06-28T12:00:00Z',
        },
        now
      )
    ).toBe(true);
  });

  it('rejects assignments that have not started or have ended', () => {
    expect(
      isActiveRoleAssignment({ roleName: 'task-supervisor', beginTime: '2026-06-28T12:00:01Z', endTime: null }, now)
    ).toBe(false);
    expect(
      isActiveRoleAssignment({ roleName: 'task-supervisor', beginTime: null, endTime: '2026-06-28T11:59:59Z' }, now)
    ).toBe(false);
  });

  it('rejects assignments with malformed time bounds', () => {
    expect(isActiveRoleAssignment({ roleName: 'task-supervisor', beginTime: 'not-a-date', endTime: null }, now)).toBe(
      false
    );
    expect(isActiveRoleAssignment({ roleName: 'task-supervisor', beginTime: '', endTime: null }, now)).toBe(false);
  });

  it('finds an active assignment by exact role name', () => {
    const assignment = findActiveRoleAssignment(
      [
        { roleName: 'task-supervisors', beginTime: null, endTime: null },
        { roleName: 'task-supervisor', beginTime: '2026-01-01T00:00:00Z', endTime: null },
      ],
      ['task-supervisor'],
      now
    );

    expect(assignment).toEqual({ roleName: 'task-supervisor', beginTime: '2026-01-01T00:00:00Z', endTime: null });
  });

  it('recognises only valid role-assignment session authorization markers', () => {
    expect(
      hasRoleAssignmentAuthorization({
        [WA_REPORTING_AUTHORIZATION_SESSION_KEY]: {
          ...buildWaReportingAuthorization('role-assignment', 'task-supervisor'),
          checkedAt: now.toISOString(),
        },
      })
    ).toBe(true);
    expect(
      hasRoleAssignmentAuthorization({
        [WA_REPORTING_AUTHORIZATION_SESSION_KEY]: buildWaReportingAuthorization('idam'),
      })
    ).toBe(false);
    expect(
      hasRoleAssignmentAuthorization({
        [WA_REPORTING_AUTHORIZATION_SESSION_KEY]: { source: 'role-assignment', checkedAt: now.toISOString() },
      })
    ).toBe(false);
    expect(
      hasRoleAssignmentAuthorization({
        [WA_REPORTING_AUTHORIZATION_SESSION_KEY]: {
          source: 'role-assignment',
          roleName: '',
          checkedAt: now.toISOString(),
        },
      })
    ).toBe(false);
    expect(
      hasRoleAssignmentAuthorization({
        [WA_REPORTING_AUTHORIZATION_SESSION_KEY]: {
          source: 'role-assignment',
          roleName: 'task-supervisor',
          checkedAt: 'not-a-date',
        },
      })
    ).toBe(false);
    expect(hasRoleAssignmentAuthorization(undefined)).toBe(false);
  });
});
