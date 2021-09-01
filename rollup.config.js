import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import pkg from './package.json'
import { terser } from 'rollup-plugin-terser'
import eslint from '@rollup/plugin-eslint'
const production = !process.env.ROLLUP_WATCH
const preamble = `/* indexed-cache - v${pkg.version}
* ${pkg.author}. Licensed ${pkg.license} */`

export default [
  {
    input: 'src/index.js',
    output: {
      name: 'IndexedCache', // Name of the global object
      file: pkg.browser,
      format: 'umd',
      sourcemap: false
    },
    plugins: [
      eslint({
        throwOnError: true
      }),
      resolve(),
      babel({
        exclude: 'node_modules/**', // only transpile our source code
        babelHelpers: 'bundled'
      }),
      commonjs(),
      production && terser({
        output: { preamble }
      })
    ]
  },
  {
    input: 'src/index.js',
    output: [
      {
        file: pkg.esm,
        format: 'esm',
        sourcemap: false
      }
    ],
    plugins: [
      eslint(),
      resolve()
    ]
  }
]
