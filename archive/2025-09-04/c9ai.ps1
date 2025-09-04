# C9 AI PowerShell Script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
& node "$scriptDir\src\index.js" $args