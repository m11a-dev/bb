import { defineConfig, type ProxyOptions, type UserConfig } from "vite";
import { loadViteDevConfig } from "@bb/config/vite-dev";
import devConfig from "./vite.dev.config.js";

const { appPort, serverHttpOrigin } = loadViteDevConfig();
const base: UserConfig = devConfig;

const webSocketProxy: ProxyOptions = {
  target: serverHttpOrigin,
  changeOrigin: true,
  ws: true,
  headers: {
    "x-forwarded-host": `127.0.0.1:${appPort}`,
    "x-forwarded-proto": "http",
  },
};

export default defineConfig({
  ...base,
  define: {
    ...base.define,
    __BB_DEV_WS_BROWSER_HOST_PORT__: JSON.stringify(appPort),
  },
  server: {
    ...base.server,
    proxy: {
      ...base.server?.proxy,
      "/ws": webSocketProxy,
    },
  },
});
