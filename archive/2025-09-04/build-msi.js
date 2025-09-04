#!/usr/bin/env node

const { MSICreator } = require('electron-wix-msi');
const path = require('path');
const fs = require('fs');

const config = require('./installer.config.js');

async function buildMSI() {
  const exePath = path.join(__dirname, 'dist', 'c9ai-win.exe');
  const outputPath = path.join(__dirname, 'dist', 'c9ai-installer.msi');
  
  // Check if executable exists
  if (!fs.existsSync(exePath)) {
    console.error('❌ Executable not found. Run "npm run build:exe" first.');
    process.exit(1);
  }
  
  console.log('🔨 Building MSI installer...');
  
  const msiCreator = new MSICreator({
    appDirectory: path.dirname(exePath),
    exe: 'c9ai-win.exe',
    name: config.name,
    manufacturer: config.manufacturer,
    version: config.version,
    description: config.description,
    outputDirectory: path.dirname(outputPath),
    
    // MSI specific options
    upgradeCode: config.properties.UpgradeCode,
    ui: {
      chooseDirectory: config.ui.chooseDirectory,
      runAfterFinish: config.ui.runAfterFinish
    },
    
    // Add registry entries
    registry: config.registry,
    
    // Add shortcuts
    shortcuts: config.shortcuts
  });
  
  try {
    await msiCreator.create();
    console.log('✅ MSI installer created successfully!');
    console.log(`📦 Installer: ${outputPath}`);
    console.log(`📏 Size: ${Math.round(fs.statSync(outputPath).size / 1024 / 1024)}MB`);
  } catch (error) {
    console.error('❌ Failed to create MSI installer:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  buildMSI().catch(console.error);
}

module.exports = { buildMSI };