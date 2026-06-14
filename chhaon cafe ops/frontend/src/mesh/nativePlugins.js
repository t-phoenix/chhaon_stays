import { registerPlugin } from "@capacitor/core";
import { WebDiscovery } from "./webDiscovery";
import { WebSignaling } from "./webSignaling";

export const CafeMeshDiscovery = registerPlugin("CafeMeshDiscovery", {
  web: () => Promise.resolve(new WebDiscovery()),
});

export const CafeMeshSignaling = registerPlugin("CafeMeshSignaling", {
  web: () => Promise.resolve(new WebSignaling()),
});
