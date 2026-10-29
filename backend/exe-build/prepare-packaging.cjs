'use strict';

// Build-time adjustments for the pinned edge-js 26.0.0 and open 10.2.0
// packages. This changes only the disposable node_modules installation, never
// the original Resturant repository. The result must be named chef.exe.
const fs = require('fs');
const path = require('path');

for (const [name, expected] of [['edge-js', '26.0.0'], ['open', '10.2.0']]) {
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'node_modules', name, 'package.json'), 'utf8'));
  if (meta.version !== expected) {
    throw new Error(`Unsupported ${name} version ${meta.version}; this build adjustment expects ${expected}.`);
  }
}

const addon = path.join(__dirname, 'node_modules', 'edge-js', 'lib', 'native', 'win32', 'x64', '24', 'edge_nativeclr.node');
const sourceName = Buffer.from('node.exe\0', 'ascii');
const packagedName = Buffer.from('chef.exe\0', 'ascii');
const bytes = fs.readFileSync(addon);
const originalAt = bytes.indexOf(sourceName);
const modifiedAt = bytes.indexOf(packagedName);

if (originalAt >= 0) {
  if (bytes.indexOf(sourceName, originalAt + 1) !== -1) {
    throw new Error('Unexpected native addon: multiple node.exe imports found.');
  }
  packagedName.copy(bytes, originalAt);
  fs.writeFileSync(addon, bytes);
} else if (modifiedAt < 0 || bytes.indexOf(packagedName, modifiedAt + 1) !== -1) {
  throw new Error('Unexpected native addon: cannot safely adjust the node.exe import.');
}

// pkg 6.24's ESM-to-CJS transform otherwise redeclares the CJS __dirname
// argument in open@10.2.0. This dependency is used by Azure's browser login;
// the backend's normal SQL password authentication does not need xdg-open.
const openPath = path.join(__dirname, 'node_modules', 'open', 'index.js');
let source = fs.readFileSync(openPath, 'utf8');
const oldLine = 'const __dirname = path.dirname(fileURLToPath(import.meta.url));';
const newLine = 'const openModuleDir = __dirname;';
if (source.includes(oldLine)) {
  source = source.replace(oldLine, newLine);
  source = source.replace("path.join(__dirname, 'xdg-open')", "path.join(openModuleDir, 'xdg-open')");
  source = source.replace("!__dirname || __dirname === '/'", "!openModuleDir || openModuleDir === '/'");
  fs.writeFileSync(openPath, source);
} else if (!source.includes(newLine)) {
  throw new Error('Unexpected open package version: cannot safely adjust ESM wrapper.');
}
console.log('Packaging dependencies prepared. Output must remain named chef.exe.');
