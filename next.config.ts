import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/predict": ["./dataset_kematangan_tape_1000.csv"],
  },
};

export default nextConfig;
