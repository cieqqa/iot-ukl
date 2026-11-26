import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/predict": ["./lib/model-kematangan.json"],
  },
};

export default nextConfig;
