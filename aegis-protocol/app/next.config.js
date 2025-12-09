/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      fs: false,
      path: false,
      crypto: false,
    };
    
    // Resolve workspace packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@aegis/sdk': require('path').resolve(__dirname, '../sdk'),
    };
    
    return config;
  },
  transpilePackages: ['@aegis/sdk'],
};

module.exports = nextConfig;
