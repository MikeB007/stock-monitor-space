/** @type {import('next').NextConfig} */
const nextConfig = {
  // API proxy for backend connection
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
    ]
  },
  // WebSocket configuration
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:4000']
    }
  }
}

module.exports = nextConfig