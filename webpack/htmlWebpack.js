const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const cssPath = path.resolve(__dirname, '../src/main/views/webpack/css-template.njk');
const jsPath = path.resolve(__dirname, '../src/main/views/webpack/js-template.njk');

const cssWebPackPlugin = new HtmlWebpackPlugin({
  template: cssPath,
  publicPath: '/',
  filename: cssPath.replace('-template', ''),
  inject: false,
});

const jsWebPackPlugin = new HtmlWebpackPlugin({
  template: jsPath,
  publicPath: '/',
  filename: 'js.njk',
  templateParameters: {
    chunkPrefix: 'main',
  },
  inject: false,
});

const analyticsJsWebPackPlugin = new HtmlWebpackPlugin({
  template: jsPath,
  publicPath: '/',
  filename: 'analytics-js.njk',
  templateParameters: {
    chunkPrefix: 'analytics',
  },
  inject: false,
});

module.exports = {
  plugins: [cssWebPackPlugin, jsWebPackPlugin, analyticsJsWebPackPlugin],
};
