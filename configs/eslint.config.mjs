import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
  { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  {
    rules: {
      'no-template-curly-in-string': 'error',
      camelcase: ['error', { ignoreGlobals: true }],
      'max-depth': ['error'],
      'max-nested-callbacks': ['error', { max: 4 }],
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'sort-imports': 'error',
      'no-loop-func': 'warn',
    },
  },
];
