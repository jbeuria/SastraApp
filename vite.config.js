import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
// 1. Import postcss-preset-env using ES Module import syntax
import postcssPresetEnv from 'postcss-preset-env';


// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
    plugins: [sveltekit()],

    css: {
        postcss: {
            plugins: [
                // 2. Use the imported module directly (call it as a function)
                postcssPresetEnv({
                    features: {
                        'custom-properties': true,
                    },
                }),
            ],
        },
    },

    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                  protocol: "ws",
                  host,
                  port: 1421,
              }
            : undefined,
        watch: {
            ignored: ["**/src-tauri/**"],
        },
    },
}));