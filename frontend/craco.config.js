// craco.config.js
const path = require("path");
require("dotenv").config();

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

let webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Production-only: inline critical above-the-fold CSS into the
      // HTML head and async-load the rest. Eliminates Lighthouse's
      // "Render-blocking requests" (~310ms saved on FCP/LCP) without
      // requiring a separate build pipeline. Skipped during dev so HMR
      // stays fast.
      if (process.env.NODE_ENV === "production") {
        try {
          const CrittersPlugin = require("critters-webpack-plugin");
          webpackConfig.plugins.push(
            new CrittersPlugin({
              // Async-load non-critical CSS via the media=print swap trick
              // — same pattern we already use for Google Fonts.
              preload: "swap",
              // Keep the original <link rel="stylesheet"> in the body as a
              // noscript fallback so users without JS still get full styles.
              noscriptFallback: true,
              // Inline @font-face declarations too (cheap and improves FOIT).
              inlineFonts: true,
              // Don't try to compress the inlined CSS — webpack's own
              // minimizers already do that on the bundled file.
              compress: false,
              // Tailwind's reset + global utilities can produce a *very*
              // long inline <style>. The plugin defaults to keeping rules
              // matching the HTML; this prunes unused selectors aggressively.
              pruneSource: false,
              logLevel: "warn",
            })
          );
        } catch (e) {
          console.warn("[craco] critters-webpack-plugin not available — skipping critical CSS inlining:", e.message);
        }
      }

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }
      return webpackConfig;
    },
  },
};

webpackConfig.devServer = (devServerConfig) => {
  // Compatibility shim: CRA 5 injects webpack-dev-server v4 middleware hooks
  // (onBeforeSetupMiddleware / onAfterSetupMiddleware), but this environment
  // runs webpack-dev-server v5 which rejects those keys during schema
  // validation. Fold them into the supported `setupMiddlewares` API and remove
  // the deprecated keys so the dev server can boot.
  const before = devServerConfig.onBeforeSetupMiddleware;
  const after = devServerConfig.onAfterSetupMiddleware;
  delete devServerConfig.onBeforeSetupMiddleware;
  delete devServerConfig.onAfterSetupMiddleware;
  // v4 `https` boolean -> v5 `server` option
  if (Object.prototype.hasOwnProperty.call(devServerConfig, "https")) {
    const useHttps = devServerConfig.https;
    delete devServerConfig.https;
    if (!devServerConfig.server) devServerConfig.server = useHttps ? "https" : "http";
  }
  // Drop any other stale v4-only keys that v5 rejects
  ["sockHost", "sockPath", "sockPort", "public", "firewall", "transportMode", "clientLogLevel"].forEach((k) => {
    if (k in devServerConfig) delete devServerConfig[k];
  });
  if (before || after) {
    const prevSetup = devServerConfig.setupMiddlewares;
    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      if (before) before(devServer);
      if (prevSetup) middlewares = prevSetup(middlewares, devServer);
      if (after) after(devServer);
      return middlewares;
    };
  }

  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

// Wrap with visual edits (automatically adds babel plugin, dev server, and overlay in dev mode)
if (isDevServer) {
  try {
    const { withVisualEdits } = require("@emergentbase/visual-edits/craco");
    webpackConfig = withVisualEdits(webpackConfig);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('@emergentbase/visual-edits/craco')) {
      console.warn(
        "[visual-edits] @emergentbase/visual-edits not installed — visual editing disabled."
      );
    } else {
      throw err;
    }
  }
}

module.exports = webpackConfig;
