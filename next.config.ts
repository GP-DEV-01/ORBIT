import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'lightweight-charts'],
  },
  // Riduce warning nei log di sviluppo
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
}

export default nextConfig;
