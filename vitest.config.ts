import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'backend',
          root: './packages/backend',
          include: ['tests/**/*.test.ts'],
        },
      },
    ],
  },
});
