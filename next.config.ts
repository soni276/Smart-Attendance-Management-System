import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow camera access from any origin (needed for /scan flow).
          // DO NOT add Cross-Origin-Embedder-Policy here — it breaks
          // face-api.js model loading on mobile browsers.
          { key: "Permissions-Policy", value: "camera=*, microphone=()" },
        ],
      },
      {
        // Long-cache face-api.js model weights so first load is the only slow one.
        source: "/models/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
