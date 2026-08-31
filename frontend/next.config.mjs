/** @type {import('next').NextConfig} */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const nextConfig = {
  reactStrictMode: true,
  // Allow the FastAPI backend to serve document/face imagery directly.
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
  async rewrites() {
    // Proxy static assets served by FastAPI (processed document crops, synthetic samples)
    // so the browser never needs a second origin / CORS round-trip for images.
    return [
      {
        source: '/backend-static/:path*',
        destination: `${API_BASE}/static/:path*`,
      },
    ];
  },
};

export default nextConfig;
