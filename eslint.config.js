const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

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
    plugins: ['@typescript-eslint', 'import', 'jest'],
    extends: [
      'eslint:recommended',
      'plugin:import/errors',
      'plugin:import/warnings',
      'plugin:import/typescript',
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
      'import/no-duplicates': 'error',
      'import/no-named-as-default': 'error',
      'import/order': [
        'error',
        {
          alphabetize: {
            caseInsensitive: false,
            order: 'asc',
          },
          'newlines-between': 'always',
        },
      ],
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
];
