import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.chhaon.cafeops",
  appName: "Chhaon Cafe Ops",
  webDir: "build",
  server: {
    androidScheme: "https",
  },
  plugins: {
    CafeMeshDiscovery: {
      serviceType: "_chhaon-ops._tcp",
    },
    CafeMeshSignaling: {
      defaultPort: 8765,
    },
  },
};

export default config;
