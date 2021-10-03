const path = require('path');
const { WebpackPnpExternals } = require('webpack-pnp-externals');
const WebpackShellPluginNext = require('webpack-shell-plugin-next');

const {
  NODE_ENV = 'production'
} = process.env;

module.exports = {
  entry: './src/index.ts',
  mode: NODE_ENV,
  target: 'node',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: ['ts-loader']
      },
      {
        test: /\.node$/,
        loader: "node-loader",
        options: {
          name: "[name].[ext]",
        },
      },
    ]
  },
  output: {
    path: path.resolve(__dirname, NODE_ENV === 'production' ? 'dist' : 'build'),
    filename: 'index.js'
  },
  watch: NODE_ENV === 'development',
  watchOptions: {
    ignored: /.yarn/
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  externals: [WebpackPnpExternals()],
  plugins: [
    new WebpackShellPluginNext({
      onBuildEnd: {
        scripts: [`if [ ${NODE_ENV} = development ]; then yarn run:dev; fi`],
        parallel: true
      }
    })
  ]
}
