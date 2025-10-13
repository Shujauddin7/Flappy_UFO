import { FlatCompat } from '@eslint/eslintrc';
import react from 'eslint-plugin-react';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    settings: { react: { version: 'detect' } },
    plugins: { react },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      // Disable prop-types as we're using TypeScript for type checking
      'react/prop-types': 'off',
    },
  },
];

export default eslintConfig;
