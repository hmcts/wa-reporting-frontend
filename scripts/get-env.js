const { execFileSync } = require('node:child_process');

const envVarMappings = [
  { secretKey: null, envVar: 'TM_DB_HOST', value: 'cft-task-postgres-db-flexible-replica-<env>.postgres.database.azure.com' },
  { secretKey: 'cft-task-POSTGRES-USER-FLEXIBLE-REPLICA', envVar: 'TM_DB_USER' },
  { secretKey: 'cft-task-POSTGRES-PASS-FLEXIBLE-REPLICA', envVar: 'TM_DB_PASSWORD' },
  { secretKey: null, envVar: 'TM_DB_OPTIONS', value: 'sslmode=verify-full' },
  { secretKey: null, envVar: 'CRD_DB_HOST', value: 'rd-caseworker-ref-api-postgres-db-v16-<env>.postgres.database.azure.com' },
  { secretKey: 'rd-caseworker-ref-api-POSTGRES-USER', envVar: 'CRD_DB_USER' },
  { secretKey: 'rd-caseworker-ref-api-POSTGRES-PASS', envVar: 'CRD_DB_PASSWORD' },
  { secretKey: null, envVar: 'CRD_DB_OPTIONS', value: 'sslmode=verify-full' },
  { secretKey: null, envVar: 'LRD_DB_HOST', value: 'rd-location-ref-api-postgres-db-v16-<env>.postgres.database.azure.com' },
  { secretKey: 'rd-location-ref-api-POSTGRES-USER', envVar: 'LRD_DB_USER' },
  { secretKey: 'rd-location-ref-api-POSTGRES-PASS', envVar: 'LRD_DB_PASSWORD' },
  { secretKey: null, envVar: 'LRD_DB_OPTIONS', value: 'sslmode=verify-full' },
];

const [, , environment] = process.argv;

if (!environment) {
  console.error('Usage: node scripts/keyvault-env.js <environment>');
  process.exit(2);
}

const applyEnvironment = (value) => (value ? value.replaceAll('<env>', environment) : value);

const readSecretValue = (secretKey) => {
  try {
    return execFileSync(
      'az',
      [
        'keyvault',
        'secret',
        'show',
        '--vault-name',
        `wa-${environment}`,
        '--name',
        applyEnvironment(secretKey),
        '--query',
        'value',
        '-o',
        'tsv',
      ],
      { encoding: 'utf8' }
    ).trim();
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.error('Azure CLI (az) is required to read from Key Vault.');
      process.exit(2);
    }
    const stderr = error && error.stderr ? error.stderr.toString().trim() : '';
    const message = error && error.message ? error.message : String(error);
    const detail = stderr ? `${message}: ${stderr}` : message;
    console.error(`Failed to read secret from Key Vault: ${detail}`);
    process.exit(1);
  }
};

const toExportLine = (envVar, value) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(envVar)) {
    console.error(`Invalid environment variable name: ${envVar}`);
    process.exit(2);
  }
  process.env[envVar] = value;
  return `export ${envVar}=${JSON.stringify(value)}`;
};

const exportLines = envVarMappings.map(({ secretKey, envVar, value }) => {
  const secretValue = secretKey ? readSecretValue(secretKey) : applyEnvironment(value);
  return toExportLine(envVar, secretValue);
});
console.log(exportLines.join('\n'));
