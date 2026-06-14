import { registerPlugin } from "@capacitor/core";

const CafeMeshDiscovery = registerPlugin("CafeMeshDiscovery", {
  web: () => import("./web").then((m) => new m.CafeMeshDiscoveryWeb()),
});

export default CafeMeshDiscovery;
