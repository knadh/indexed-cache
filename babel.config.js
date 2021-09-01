module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          browsers: '> 0.5%, ie >= 11'
        },
        modules: false,
        spec: true,
        useBuiltIns: 'usage',
        forceAllTransforms: true,
        corejs: 3
      }
    ]
  ]
}
