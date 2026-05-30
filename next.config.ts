import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['pdf-lib', 'pdfjs-dist', 'qrcode', 'qrcode-generator'],
  turbopack: {},
};

export default nextConfig;
