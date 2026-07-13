import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['pdf-lib', 'pdfjs-dist', 'qrcode', 'qrcode-generator'],
  // Allow the sandbox preview panel (served from *.space-z.ai) to load /_next/* dev assets
  allowedDevOrigins: ['*.space-z.ai', 'localhost', '127.0.0.1'],
  turbopack: {},
};

export default nextConfig;
