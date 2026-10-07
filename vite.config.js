import {
    defineConfig
} from "vite";

export default defineConfig({
    base: "/run-for-live/",

    build: {
        outDir: "dist",
        emptyOutDir: true
    }
});
