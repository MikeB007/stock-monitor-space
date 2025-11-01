/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enhanced development experience
  reactStrictMode: true,
  swcMinify: true,

  // Fast refresh configuration
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:4000']
    },
    turbo: {
      // Enable Turbopack for faster builds
      rules: {
        '*.tsx': ['@next/swc-loader'],
        '*.ts': ['@next/swc-loader']
      }
    }
  },

  // API proxy for backend connection
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
    ]
  },

  // Development optimizations
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Enable hot reload for better development experience
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  }
}

module.exports = nextConfig