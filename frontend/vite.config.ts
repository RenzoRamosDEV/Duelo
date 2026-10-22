import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable app with an offline app shell. Only the build output is precached, minus the
    // on-demand effects and the big icons, which are cached on first use (same origin, hashed or
    // static files only), so API calls and anything from another origin always hit the network.
    VitePWA({
      // The user decides when to reload (see `components/UpdatePrompt`); never mid-review.
      registerType: "prompt",
      // The icons live in `public/` and are already matched by `globPatterns` below.
      includeManifestIcons: false,
      manifest: {
        name: "Duelo",
        short_name: "Duelo",
        description: "Claude Code y Codex revisan cada commit; tú decides qué review fue mejor.",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#0d1117",
        background_color: "#0d1117",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // The app shell: build output plus the static icons copied from `public/`.
        globPatterns: ["**/*.{js,css,html,png,webp}"],
        globIgnores: [
          "**/HeroImageFx-*.js",
          "**/MetalRing-*.js",
          "**/BeamLayer-*.js",
          "**/FluidThemeSwitch-*.js",
          "**/pwa-*.png",
        ],
        runtimeCaching: [
          {
            // Serialised into the service worker: it cannot use anything defined outside it.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              /\/(assets\/(HeroImageFx|MetalRing|BeamLayer|FluidThemeSwitch)-[^/]+\.js|pwa-[^/]+\.png)$/.test(
                url.pathname,
              ),
            handler: "CacheFirst",
            options: { cacheName: "duelo-fx", expiration: { maxEntries: 16 } },
          },
        ],
        // SPA routes resolve on the client; `/api/` is excluded in case the API is ever same-origin.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: false,
    // One jsdom per worker instead of one per file (68 files): the suite takes half the time and
    // each file keeps its own module isolation. `setup.ts` cleans the DOM after every test.
    pool: "vmThreads",
  },
});
