import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // The internal Search Eval fixture is versioned at the repository root.
    root: path.resolve(__dirname, ".."),
  },
};

export default nextConfig;
