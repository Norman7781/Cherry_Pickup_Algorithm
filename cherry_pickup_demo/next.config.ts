import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const localAddresses = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .map(({ address }) => address);

const nextConfig: NextConfig = {
  // Allow the current machine's addresses even when DHCP changes its LAN IP.
  allowedDevOrigins: ["127.0.0.1", ...localAddresses],
};

export default nextConfig;
