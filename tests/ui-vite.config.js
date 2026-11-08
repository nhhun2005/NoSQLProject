import { defineConfig, mergeConfig } from 'vite';
import base from '../vite.config.js';
export default mergeConfig(base, defineConfig({
  server: {
    port: 5001,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      }
    }
  }
}));
