import { getMeta, setMeta } from "@/offline/db";

const DEVICE_ID_KEY = "mesh_device_id";
const DEVICE_NAME_KEY = "mesh_device_name";

export async function getOrCreateDeviceId() {
  let id = await getMeta(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    await setMeta(DEVICE_ID_KEY, id);
  }
  return id;
}

export async function getDeviceName() {
  let name = await getMeta(DEVICE_NAME_KEY);
  if (!name) {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const platform = ua.includes("iPhone") ? "iPhone" : ua.includes("Android") ? "Android" : "Device";
    name = `Chhaon ${platform}`;
    await setMeta(DEVICE_NAME_KEY, name);
  }
  return name;
}

export async function setDeviceName(name) {
  await setMeta(DEVICE_NAME_KEY, name);
}
