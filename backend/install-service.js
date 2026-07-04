const Service = require('node-windows').Service;
const path = require('path'); 

const svc = new Service({
  name: 'MICRO_E_CHEF_BACKEND', 
  description: 'Micro E Chef Restaurant POS System Backend Express Server.', 
  script: path.join(__dirname, 'server.js'), 
  
  nodePath: path.join(__dirname, 'node.exe'), 
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    }
  ]
});

svc.on('install', function() {
  console.log('Service [MICRO_E_CHEF_BACKEND] installed successfully!');
  svc.start(); 
});

svc.on('alreadyinstalled', function() {
  console.log('This service is already installed.');
});

svc.install();