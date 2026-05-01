import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['dockerode', 'ssh2'],
  turbopack: {
    resolveAlias: {
      'shadcn/tailwind.css': './node_modules/shadcn/dist/tailwind.css',
      'tw-animate-css': './node_modules/tw-animate-css/dist/tw-animate.css',
    },
  },
};

export default nextConfig;
