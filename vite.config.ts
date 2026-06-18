import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const intakeBatchPath = resolve(__dirname, 'data/monari-intake/batches/batch_001.json');
const intakePublicPath = '/data/monari-intake/batches/batch_001.json';

function localIntakeData(): Plugin {
  return {
    name: 'monarium-local-intake-data',
    configureServer(server) {
      server.middlewares.use(intakePublicPath, (_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.end(readFileSync(intakeBatchPath, 'utf8'));
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'data/monari-intake/batches/batch_001.json',
        source: readFileSync(intakeBatchPath, 'utf8'),
      });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [localIntakeData()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  },
  server: {
    port: 3000
  }
});
