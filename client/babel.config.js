module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
          alias: {
            '@app': './src/app',
            '@components': './src/components',
            '@hooks': './src/hooks',
            '@models': './src/models',
            '@particles': './src/particles',
            '@screens': './src/screens',
            '@services': './src/services',
            '@storage': './src/storage',
            '@theme': './src/theme',
          },
        },
      ],
    ],
  };
};

