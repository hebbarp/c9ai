module.exports = {
  // MSI Installer Configuration for C9 AI CLI
  name: 'C9 AI',
  description: 'C9 AI - Autonomous AI-Powered Productivity CLI with Local LLM Support',
  manufacturer: 'C9 AI Team',
  version: '2.0.0',
  
  // Installation settings
  installDirectory: 'C9AI',
  programFilesFolder: true,
  
  // MSI properties
  properties: {
    UpgradeCode: '{12345678-1234-1234-1234-123456789012}', // Generate unique GUID for production
    ProductCode: '{87654321-4321-4321-4321-210987654321}', // Generate unique GUID for production
    Manufacturer: 'C9 AI Team',
    ProductName: 'C9 AI CLI',
    ProductVersion: '2.0.0',
    Comments: 'AI-powered productivity CLI with local LLM support',
    Keywords: 'AI,CLI,Productivity,Local LLM,Privacy'
  },
  
  // UI settings
  ui: {
    chooseDirectory: true,
    runAfterFinish: false
  },
  
  // Registry entries
  registry: [
    {
      root: 'HKLM',
      key: 'SOFTWARE\\C9AI',
      name: 'InstallPath',
      value: '[INSTALLDIR]'
    },
    {
      root: 'HKLM', 
      key: 'SOFTWARE\\C9AI',
      name: 'Version',
      value: '2.0.0'
    }
  ],
  
  // Add to PATH
  environment: [
    {
      name: 'PATH',
      value: '[INSTALLDIR]',
      action: 'set'
    }
  ],
  
  // Start menu shortcuts
  shortcuts: [
    {
      name: 'C9 AI CLI',
      description: 'AI-powered productivity CLI',
      target: '[INSTALLDIR]c9ai.exe',
      workingDirectory: '[INSTALLDIR]'
    }
  ]
};