import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // transformers.js ships WASM/ONNX assets that must not be bundled by Next —
  // keep it external so the local embedding model loads at runtime.
  serverExternalPackages: ["@xenova/transformers"],
};

export default nextConfig;
