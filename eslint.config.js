const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const playwright = require('eslint-plugin-playwright');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  {
    ignores: [
      'dist/*',
      'build/*',
      'coverage/*',
      '**/*.d.ts',
      'src/main/public/**',
      'src/main/types/**',
      'jest.*config.js',
      'src/test/*/codecept.conf.js',
      'src/test/config.ts',
      'playwright.config.mjs',
      'playwright.a11y.config.mjs',
      '**/*.js',
      '.yarn/**',
      '.pnp.*',
      'src/main/views/govuk/**',
      'src/main/views/moj/**',
    ],
  },
  ...compat.config({
    root: true,
    env: { browser: true, es6: true, node: true },
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'jest'],
    extends: [
      'eslint:recommended',
      'plugin:jest/recommended',
      'plugin:@typescript-eslint/eslint-recommended',
      'plugin:@typescript-eslint/recommended',
      'prettier',
    ],
    parserOptions: {
      ecmaVersion: 2018,
      sourceType: 'module',
      project: './tsconfig.eslint.json',
      tsconfigRootDir: __dirname,
    },
    globals: { Atomics: 'readonly', SharedArrayBuffer: 'readonly' },
    rules: {
      '@typescript-eslint/array-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-var-requires': 'off',
      curly: 'error',
      eqeqeq: 'error',
      'jest/prefer-to-have-length': 'error',
      'jest/valid-expect': 'off',
      'linebreak-style': ['error', 'unix'],
      'no-console': 'warn',
      'no-prototype-builtins': 'off',
      'no-return-await': 'error',
      'no-unneeded-ternary': [
        'error',
        {
          defaultAssignment: false,
        },
      ],
      'object-curly-spacing': ['error', 'always'],
      'object-shorthand': ['error', 'properties'],
      quotes: [
        'error',
        'single',
        {
          allowTemplateLiterals: false,
          avoidEscape: true,
        },
      ],
      semi: ['error', 'always'],
      'sort-imports': [
        'error',
        {
          allowSeparatedGroups: false,
          ignoreCase: false,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
        },
      ],
    },
  }),
  {
    files: ['src/test/**/*.spec.ts'],
    ...playwright.configs['flat/recommended'],
  },
];
