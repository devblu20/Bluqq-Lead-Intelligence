import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  basePath: "/lead-intelligence",

  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(__dirname);
    return config;
  },
};

export default nextConfig;