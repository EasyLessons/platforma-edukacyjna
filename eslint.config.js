import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'dist/**', 'build/**', '.git/**'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: await import('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Fonty tylko lokalnie: next/font/google pobiera pliki z Google Fonts w trakcie
      // `next build` i przy niedostepnosci Google build w CI pada losowo.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/font/google',
              message:
                'Uzyj fontow z @new/shared/fonts (next/font/local, pliki woff2 w repo) - bez pobierania z Google Fonts podczas builda.',
            },
          ],
        },
      ],
    },
  },
];
