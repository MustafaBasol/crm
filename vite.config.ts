import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const readBackendEnvPort = (): string | null => {
  try {
    const envPath = path.resolve(__dirname, 'backend', '.env');
    const content = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^PORT\s*=\s*(.+)\s*$/);
      if (!match) continue;

      let value = match[1].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) return null;
      return String(Math.trunc(numeric));
    }
  } catch {
    // ignore
  }
  return null;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPortFromFile = readBackendEnvPort();
  const backendPort =
    env.VITE_BACKEND_PORT || env.BACKEND_PORT || backendPortFromFile || '3000';
  const backendTarget =
    env.VITE_BACKEND_URL || env.BACKEND_URL || `http://localhost:${backendPort}`;

  return {
    plugins: [react()],
    server: {
      // Codespaces & containers: listen on all interfaces
      host: '0.0.0.0',
      port: 5174,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    // Removed lucide-react exclusion to allow normal prebundling
  };
});
