import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // Hand-uploaded area reports; matches the ingest endpoint's 4 MB cap plus form overhead.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
