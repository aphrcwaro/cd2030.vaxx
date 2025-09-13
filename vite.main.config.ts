import { defineConfig } from 'vite';
import { version } from './package.json'

// https://vitejs.dev/config
export default defineConfig({
    define: { __APP_VERSION__: JSON.stringify(version) }
});
