'use strict';

// Build an isolated Windows x64 executable without copying credentials or
// changing the project's ordinary node_modules/installer/service.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const buildConfigDir = __dirname;
const backendDir = path.resolve(buildConfigDir, '..');
const outputDir = process.env.MICRO_E_CHEF_EXE_OUTPUT_DIR
  ? path.resolve(process.env.MICRO_E_CHEF_EXE_OUTPUT_DIR)
  : path.join(backendDir, 'dist');
const outputFile = path.join(outputDir, 'chef.exe');

function run(args, cwd, { rejectBytecodeFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let bytecodeFailure = false;
    const forward = (destination) => {
      let tail = '';
      return (chunk) => {
        destination.write(chunk);
        const combined = tail + chunk.toString('utf8');
        if (/Failed to generate V8 bytecode/i.test(combined)) bytecodeFailure = true;
        tail = combined.slice(-128);
      };
    };
    child.stdout.on('data', forward(process.stdout));
    child.stderr.on('data', forward(process.stderr));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal || code !== 0) {
        reject(new Error(`Build command failed (${signal || `exit ${code}`}).`));
      } else if (rejectBytecodeFailure && bytecodeFailure) {
        reject(new Error('A JavaScript file failed bytecode generation; the EXE was not published.'));
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 22) {
    throw new Error('Use Node.js 22 or newer on the build PC; Node.js 24 x64 is recommended.');
  }
  if (process.arch !== 'x64') {
    throw new Error('Use an x64 Node.js build environment.');
  }
  // npm sets this absolute path when the script is invoked with npm run.
  const npmCli = process.env.npm_execpath;
  if (!npmCli || !fs.existsSync(npmCli)) {
    throw new Error('Run this from backend using: npm run build:exe');
  }

  const projectLock = JSON.parse(fs.readFileSync(path.join(backendDir, 'package-lock.json'), 'utf8'));
  const buildLock = JSON.parse(fs.readFileSync(path.join(buildConfigDir, 'package-lock.json'), 'utf8'));
  const buildManifest = JSON.parse(fs.readFileSync(path.join(buildConfigDir, 'package.json'), 'utf8'));
  for (const name of Object.keys(buildManifest.dependencies)) {
    const entry = `node_modules/${name}`;
    const projectVersion = projectLock.packages?.[entry]?.version;
    const buildVersion = buildLock.packages?.[entry]?.version;
    if (projectVersion !== buildVersion) {
      console.warn(`[build] ${name}: backend lock=${projectVersion || 'missing'}, EXE lock=${buildVersion || 'missing'}. Review the EXE dependencies before shipping.`);
    }
  }

  // Only these known backend files are copied; never copy .env or any DLL.
  // If the backend gains routes/assets or dependencies, update this list and
  // the build manifest/lock file in exe-build.
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'micro-e-chef-exe-'));
  try {
    fs.copyFileSync(path.join(backendDir, 'server.js'), path.join(stage, 'server.js'));
    fs.mkdirSync(path.join(stage, 'routes'));
    fs.copyFileSync(path.join(backendDir, 'routes', 'aiReport.js'), path.join(stage, 'routes', 'aiReport.js'));
    for (const file of ['package.json', 'package-lock.json', 'prepare-packaging.cjs']) {
      fs.copyFileSync(path.join(buildConfigDir, file), path.join(stage, file));
    }

    console.log('[build] Installing locked EXE dependencies into a temporary folder...');
    await run([npmCli, 'ci', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund'], stage);
    await run([path.join(stage, 'prepare-packaging.cjs')], stage);

    console.log('[build] Packaging for Windows x64; this may take a few minutes...');
    const stagedExe = path.join(stage, 'chef.exe');
    const args = [
      npmCli, 'exec', '--yes', '--package=@yao-pkg/pkg@6.24.0', '--',
      'pkg', '.', '--target', 'node24-win-x64', '--compress', 'Brotli',
      '--output', 'chef.exe',
    ];
    if (process.env.MICRO_E_CHEF_EXE_DEBUG === '1') args.push('--debug');
    await run(args, stage, { rejectBytecodeFailure: true });
    if (!fs.existsSync(stagedExe)) throw new Error('The packager did not produce chef.exe.');

    // Publish only a successful build; do not remove/replace an earlier output
    // until the complete new file has been copied to its destination volume.
    fs.mkdirSync(outputDir, { recursive: true });
    const partial = path.join(outputDir, `.chef-${process.pid}-${Date.now()}.tmp`);
    try {
      fs.copyFileSync(stagedExe, partial, fs.constants.COPYFILE_EXCL);
      fs.renameSync(partial, outputFile);
    } finally {
      fs.rmSync(partial, { force: true });
    }
    console.log(`\n[build] Ready: ${outputFile}`);
    console.log('[build] Do not rename chef.exe. Supply DbProtector.dll separately next to it.');
  } finally {
    try {
      fs.rmSync(stage, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[build] Could not remove temporary build folder ${stage}: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(`[build] ${err.message}`);
  process.exitCode = 1;
});
