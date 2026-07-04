const Service = require('node-windows').Service;
const path = require('path'); 

const svc = new Service({
  name: 'MICRO_E_CHEF_BACKEND', 
  description: 'Micro E Chef Restaurant POS System Backend Express Server.',
  script: path.join(__dirname, 'server.js'),
 
  nodePath: path.join(__dirname, 'node.exe')
});

svc.on('uninstall', function() {
  console.log('Service [MICRO_E_CHEF_BACKEND] uninstalled successfully!');
  console.log('Does the service exist? ', svc.exists);
});

svc.uninstall();