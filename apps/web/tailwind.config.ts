import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        panel: '#111827',
        line: '#243041',
        accent: '#d4a24c',
      },
      boxShadow: {
        panel: '0 20px 45px rgba(0, 0, 0, 0.28)',
      },
      backgroundImage: {
        'industrial-grid':
          'linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};

export default config;
