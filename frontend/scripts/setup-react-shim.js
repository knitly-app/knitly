#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const reactDir = join(__dirname, '../node_modules/react')

try {
  mkdirSync(reactDir, { recursive: true })
} catch {}

writeFileSync(
  join(reactDir, 'package.json'),
  JSON.stringify({
    name: 'react',
    version: '18.2.0',
    main: 'index.js',
    exports: {
      '.': './index.js',
      './jsx-runtime': './jsx-runtime.js',
      './jsx-dev-runtime': './jsx-dev-runtime.js'
    }
  }, null, 2)
)

writeFileSync(join(reactDir, 'index.js'), "module.exports = require('preact/compat');\n")
writeFileSync(join(reactDir, 'jsx-runtime.js'), "module.exports = require('preact/jsx-runtime');\n")
writeFileSync(join(reactDir, 'jsx-dev-runtime.js'), "module.exports = require('preact/jsx-runtime');\n")

console.log('React shim for Bun tests created')
