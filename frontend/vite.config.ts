import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Aplicación instalable con app shell sin conexión. Solo se precachea el build (los iconos
    // grandes se cachean al primer uso); las llamadas a la API y otros orígenes van siempre a red.
    VitePWA({
      // El usuario decide cuándo recargar (ver `components/UpdatePrompt`), nunca a mitad de review.
      registerType: "prompt",
      // Los iconos viven en `public/` y ya los recoge `globPatterns`.
      includeManifestIcons: false,
      manifest: {
        name: "Duelo",
        short_name: "Duelo",
        description: "Claude Code y Codex revisan cada commit; tú decides qué review fue mejor.",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
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
        globPatterns: ["**/*.{js,css,html,png}"],
        globIgnores: ["**/pwa-*.png"],
        runtimeCaching: [
          {
            // Se serializa dentro del service worker: no puede usar nada definido fuera.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\/pwa-[^/]+\.png$/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "duelo-icons", expiration: { maxEntries: 8 } },
          },
        ],
        // Las rutas de la SPA se resuelven en el cliente; `/api/` queda fuera por si algún día
        // la API comparte origen.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
