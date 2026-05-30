import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['pdf-lib', 'pdfjs-dist'],
  turbopack: {},
};

export default nextConfig;
