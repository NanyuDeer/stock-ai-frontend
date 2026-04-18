/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://extapi.aistocklink.cn/api/:path*',
      },
      {
        source: '/deepseek/:path*',
        destination: 'https://api.deepseek.com/:path*',
      },
      {
        source: '/kronos/:path*',
        destination: 'http://localhost:8000/:path*',
      },
    ]
  },
}

export default nextConfig
