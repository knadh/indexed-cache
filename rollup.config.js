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
  // UMD build only for modern browsers.
  {
    input: 'src/index.js',
    output: {
      name: 'IndexedCache',
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
        exclude: 'node_modules/**',
        babelHelpers: 'bundled',
        presets: [
          [
            '@babel/preset-env',
            {
              targets: {
                node: '6.5'
              }
            }
          ]
        ]
      }),
      commonjs(),
      production && terser({
        output: { preamble }
      })
    ]
  },
  // UMD build for legacy browsers which has polyfills + es5 transpilation.
  {
    input: 'src/index.js',
    output: {
      name: 'IndexedCache',
      file: pkg.browserLegacy,
      format: 'umd',
      sourcemap: false
    },
    plugins: [
      eslint({
        throwOnError: true
      }),
      resolve(),
      babel({
        exclude: 'node_modules/**',
        babelHelpers: 'bundled',
        presets: [
          [
            '@babel/preset-env',
            {
              targets: {
                browsers: '> 0.5%, not op_mini all, not dead'
              },
              modules: false,
              spec: true,
              useBuiltIns: 'usage',
              forceAllTransforms: true,
              corejs: 3
            }
          ]
        ]
      }),
      commonjs(),
      production && terser({
        output: { preamble }
      })
    ]
  },
  // ESM build which can be used as module.
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
      resolve(),
      production && terser({
        output: { preamble }
      })
    ]
  }
]
