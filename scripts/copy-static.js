const fs = require('fs');
const path = require('path');

const root = process.cwd();
const copy = (source, destination) => fs.cpSync(source, destination, { recursive: true });

copy(path.join(root, 'src/main/views'), path.join(root, 'dist/main/views'));
copy(path.join(root, 'src/main/public'), path.join(root, 'dist/main/public'));

console.log('Copied static views and public assets into dist/main.');
