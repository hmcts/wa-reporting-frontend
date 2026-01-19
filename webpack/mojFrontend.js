const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');

const rootExport = require.resolve('@ministryofjustice/frontend/package.json');
const root = path.resolve(rootExport, '..');
const mojRoot = path.resolve(root, 'moj');
const sass = path.resolve(mojRoot, 'all.scss');
const javascript = path.resolve(mojRoot, 'all.bundle.js');
const components = path.resolve(mojRoot, 'components');
const assets = path.resolve(mojRoot, 'assets');

const copyMojTemplateAssets = new CopyWebpackPlugin({
  patterns: [
    { from: `${mojRoot}/template.njk`, to: '../views/moj' },
    {
      from: '**/*.njk',
      to: '../views/moj/components/[path][name][ext]',
      context: components,
    },
    { from: assets, to: 'assets/moj' },
  ],
});

module.exports = {
  paths: { template: mojRoot, components, sass, javascript, assets },
  plugins: [copyMojTemplateAssets],
};
