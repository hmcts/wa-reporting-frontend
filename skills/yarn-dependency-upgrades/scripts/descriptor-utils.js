const DESCRIPTOR_MARKERS = [
  '@virtual:',
  '@npm:',
  '@workspace:',
  '@patch:',
  '@portal:',
  '@file:',
  '@link:',
  '@git:',
  '@http:',
  '@https:',
];

function parseNameFromDescriptor(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  for (const marker of DESCRIPTOR_MARKERS) {
    const markerIndex = value.indexOf(marker);
    if (markerIndex > 0) {
      return value.slice(0, markerIndex);
    }
  }

  const match = value.match(/^(@[^/]+\/[^@]+|[^@]+)@/);
  if (match) {
    return match[1];
  }

  return value;
}

function splitPackageVersionSpecifier(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return {
      packageName: null,
      version: null,
    };
  }

  const versionSeparator = value.startsWith('@') ? value.indexOf('@', value.indexOf('/') + 1) : value.indexOf('@');

  if (versionSeparator > 0) {
    return {
      packageName: value.slice(0, versionSeparator),
      version: value.slice(versionSeparator + 1) || null,
    };
  }

  return {
    packageName: null,
    version: value,
  };
}

function parseNpmResolutionValue(descriptor, value) {
  const descriptorPackageName = parseNameFromDescriptor(descriptor);

  if (typeof value !== 'string' || value.length === 0) {
    return {
      descriptorPackageName,
      protocol: null,
      supported: false,
      targetPackageName: null,
      targetVersion: null,
      valueFormat: null,
    };
  }

  const protocolSeparator = value.indexOf(':');
  const protocol = protocolSeparator > 0 ? value.slice(0, protocolSeparator) : 'npm';

  if (protocol !== 'npm') {
    return {
      descriptorPackageName,
      protocol,
      supported: false,
      targetPackageName: null,
      targetVersion: null,
      valueFormat: null,
    };
  }

  const specifier = protocolSeparator > 0 ? value.slice(protocolSeparator + 1) : value;
  const { packageName, version } = splitPackageVersionSpecifier(specifier);

  return {
    descriptorPackageName,
    protocol,
    supported: Boolean(descriptorPackageName && version),
    targetPackageName: packageName || descriptorPackageName,
    targetVersion: version,
    valueFormat: packageName ? 'named' : 'version-only',
  };
}

function buildSuggestedNpmResolutionValue(parsedResolution, latestVersion) {
  if (!parsedResolution?.supported || typeof latestVersion !== 'string' || latestVersion.length === 0) {
    return null;
  }

  if (parsedResolution.valueFormat === 'named') {
    return `npm:${parsedResolution.targetPackageName}@${latestVersion}`;
  }

  return `npm:${latestVersion}`;
}

module.exports = {
  buildSuggestedNpmResolutionValue,
  parseNameFromDescriptor,
  parseNpmResolutionValue,
  splitPackageVersionSpecifier,
};
