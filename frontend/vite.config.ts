import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'

const projectRoot = path.resolve(__dirname, '..')
const frontendNodeModules = path.resolve(__dirname, 'node_modules')

function resolveCustomImports(): Plugin {
  return {
    name: 'resolve-custom-imports',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !importer.startsWith(path.join(projectRoot, 'custom'))) return null
      if (source.startsWith('.') || source.startsWith('/') || source.startsWith('@knitly')) return null
      return this.resolve(source, path.join(frontendNodeModules, '_virtual.js'), { skipSelf: true })
    },
  }
}

export default defineConfig({
  plugins: [resolveCustomImports(), preact()],
  server: {
    fs: { allow: [path.resolve(__dirname, '..')] },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      '@knitly': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-preact': ['preact', 'preact/compat', 'preact/hooks'],
          'vendor-router': ['@tanstack/react-router'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-state': ['zustand'],
        },
      },
    },
  },
})
