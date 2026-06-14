import { registerPlugin } from "@capacitor/core";

const CafeMeshSignaling = registerPlugin("CafeMeshSignaling", {
  web: () => import("./web").then((m) => new m.CafeMeshSignalingWeb()),
});

export default CafeMeshSignaling;
