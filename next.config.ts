import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["never-forget-engine", "better-sqlite3"],
};

export default nextConfig;
