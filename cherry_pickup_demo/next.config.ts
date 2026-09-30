import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let the dev server hydrate pages opened via the loopback IP or the LAN IP,
  // not only via "localhost".
  allowedDevOrigins: ["127.0.0.1", "192.168.1.35"],
};

export default nextConfig;
