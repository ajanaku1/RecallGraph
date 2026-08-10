import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['src/**/*.{ts,tsx}'],
  })),
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['tests/**/*.{ts,tsx}'],
  })),
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/app/api/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSAsExpression',
          message: 'Do not use as unknown as in production app boundaries.',
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
);
