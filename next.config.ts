import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.brawlify.com" },
      { protocol: "https", hostname: "cdn.brawlstars.com" },
    ],
  },
};

export default nextConfig;
