/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    let rawBackendUrl = (
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://127.0.0.1:8005'
    ).trim();

    // Support Render private service hostname (e.g. "bricdoc-api" or "bricdoc-api:10000")
    if (rawBackendUrl && !rawBackendUrl.startsWith('http://') && !rawBackendUrl.startsWith('https://')) {
      rawBackendUrl = `http://${rawBackendUrl}`;
    }

    const backendUrl = rawBackendUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '').trim();
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
