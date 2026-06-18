type ParsedNpmResolutionValue = {
  descriptorPackageName: string | null;
  protocol: string | null;
  supported: boolean;
  targetPackageName: string | null;
  targetVersion: string | null;
  valueFormat: 'named' | 'version-only' | null;
};

type DescriptorUtils = {
  buildSuggestedNpmResolutionValue: (
    parsedResolution: ParsedNpmResolutionValue,
    latestVersion: string
  ) => string | null;
  parseNameFromDescriptor: (value: string) => string | null;
  parseNpmResolutionValue: (descriptor: string, value: string) => ParsedNpmResolutionValue;
};

type ResolutionPlanItem = {
  descriptor: string;
  packageName: string | null;
  currentTarget: string;
  currentTargetPackage: string | null;
  currentVersion: string | null;
  latestVersion: string | null;
  needsUpgrade: boolean;
  suggestedPackageJsonValue: string | null;
  notes: string[];
};

type ResolutionUpgradePlanModule = {
  buildResolutionUpgradePlan: (
    pkg: { resolutions?: Record<string, string> },
    options?: {
      getLatestVersion?: (packageName: string) => string | null;
    }
  ) => ResolutionPlanItem[];
};

const descriptorUtils =
  require('../../../../skills/yarn-dependency-upgrades/scripts/descriptor-utils.js') as DescriptorUtils;
const resolutionUpgradePlan =
  require('../../../../skills/yarn-dependency-upgrades/scripts/resolution-upgrade-plan.js') as ResolutionUpgradePlanModule;

describe('yarn dependency resolution upgrade planning', () => {
  test('parses bare and descriptor-specific Yarn package names', () => {
    expect(descriptorUtils.parseNameFromDescriptor('@hono/node-server')).toBe('@hono/node-server');
    expect(descriptorUtils.parseNameFromDescriptor('@opentelemetry/core@npm:2.7.1')).toBe('@opentelemetry/core');
    expect(descriptorUtils.parseNameFromDescriptor('@opentelemetry/core@virtual:abc123#npm:^2.7.1')).toBe(
      '@opentelemetry/core'
    );
  });

  test('parses named npm alias resolution values', () => {
    expect(descriptorUtils.parseNpmResolutionValue('@hono/node-server', 'npm:@hono/node-server@2.0.4')).toEqual({
      descriptorPackageName: '@hono/node-server',
      protocol: 'npm',
      supported: true,
      targetPackageName: '@hono/node-server',
      targetVersion: '2.0.4',
      valueFormat: 'named',
    });
  });

  test('parses version-only npm resolution values for descriptor-specific keys', () => {
    expect(descriptorUtils.parseNpmResolutionValue('@opentelemetry/core@npm:2.7.1', 'npm:2.8.0')).toEqual({
      descriptorPackageName: '@opentelemetry/core',
      protocol: 'npm',
      supported: true,
      targetPackageName: '@opentelemetry/core',
      targetVersion: '2.8.0',
      valueFormat: 'version-only',
    });
  });

  test('marks non-npm resolution protocols for manual review', () => {
    expect(descriptorUtils.parseNpmResolutionValue('example', 'portal:../example')).toEqual({
      descriptorPackageName: 'example',
      protocol: 'portal',
      supported: false,
      targetPackageName: null,
      targetVersion: null,
      valueFormat: null,
    });
  });

  test('reports stale retained resolutions without mutating package data', () => {
    const packageJson = {
      resolutions: {
        '@hono/node-server': 'npm:@hono/node-server@2.0.4',
        '@opentelemetry/core@npm:2.7.1': 'npm:2.8.0',
        example: 'portal:../example',
      },
    };
    const latestVersions: Record<string, string> = {
      '@hono/node-server': '2.0.5',
      '@opentelemetry/core': '2.8.0',
    };
    const getLatestVersion = jest.fn((packageName: string): string | null => latestVersions[packageName] ?? null);

    const plan = resolutionUpgradePlan.buildResolutionUpgradePlan(packageJson, { getLatestVersion });

    expect(packageJson.resolutions['@hono/node-server']).toBe('npm:@hono/node-server@2.0.4');
    expect(plan).toHaveLength(3);
    expect(plan.find(item => item.descriptor === '@hono/node-server')).toMatchObject({
      currentVersion: '2.0.4',
      latestVersion: '2.0.5',
      needsUpgrade: true,
      suggestedPackageJsonValue: 'npm:@hono/node-server@2.0.5',
      notes: [
        'After updating this resolution, run `yarn install` and the production audit; revert or narrow it if install, audit, or tests fail.',
      ],
    });
    expect(plan.find(item => item.descriptor === '@opentelemetry/core@npm:2.7.1')).toMatchObject({
      currentVersion: '2.8.0',
      latestVersion: '2.8.0',
      needsUpgrade: false,
      suggestedPackageJsonValue: 'npm:2.8.0',
    });
    expect(plan.find(item => item.descriptor === 'example')).toMatchObject({
      latestVersion: null,
      needsUpgrade: false,
      suggestedPackageJsonValue: null,
      notes: ['Unsupported resolution protocol "portal"; review manually.'],
    });
    expect(getLatestVersion).toHaveBeenCalledWith('@hono/node-server');
    expect(getLatestVersion).toHaveBeenCalledWith('@opentelemetry/core');
    expect(getLatestVersion).not.toHaveBeenCalledWith('example');
  });
});
