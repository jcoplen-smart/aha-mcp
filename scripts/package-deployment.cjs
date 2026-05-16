#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const zipName = 'aha-mcp.zip';
const zipPath = path.join(projectRoot, zipName);

async function createPackage() {
  console.log('Creating deployment package:', zipName);

  // Remove old zip if it exists
  if (fs.existsSync(zipPath)) {
    console.log('Removing existing', zipName + '...');
    fs.unlinkSync(zipPath);
  }

  // Dynamic import for ESM-only archiver package
  const { ZipArchive } = await import('archiver');

  // Create zip archive
  const output = fs.createWriteStream(zipPath);
  const archive = new ZipArchive({
    zlib: { level: 9 } // Maximum compression
  });

  output.on('close', () => {
    const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log(`✓ Created ${zipName} (${sizeInMB} MB)`);
    console.log('Ready for deployment to users');
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);

  // Add directories
  console.log('Packaging build/ and node_modules/...');
  archive.directory('build/', 'build/');

  // Use glob to properly exclude junk files from node_modules
  archive.glob('**/*', {
    cwd: 'node_modules',
    prefix: 'node_modules/',
    ignore: ['**/.cache/**', '**/.git/**', '**/.DS_Store']
  });

  // Finalize the archive
  await archive.finalize();
}

createPackage().catch((err) => {
  console.error('Failed to create package:', err);
  process.exit(1);
});
