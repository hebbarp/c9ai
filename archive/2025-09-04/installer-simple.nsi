; C9AI Simple Installer Script for NSIS
; Creates a basic Windows installer without PATH manipulation

!define APP_NAME "C9 AI CLI"
!define APP_VERSION "2.1.0"
!define APP_PUBLISHER "C9 AI Team"
!define APP_EXE "c9ai-win.exe"

; Installer settings
Name "${APP_NAME}"
OutFile "dist\c9ai-installer.exe"
InstallDir "$PROGRAMFILES\C9AI"
RequestExecutionLevel admin

; Pages
Page directory
Page instfiles

UninstPage uninstConfirm
UninstPage instfiles

; Installation section
Section "Install"
  ; Set output path to installation directory
  SetOutPath $INSTDIR
  
  ; Copy the executable
  File "dist\${APP_EXE}"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  ; Add to Add/Remove Programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                   "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                   "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                   "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                   "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                   "EstimatedSize" "5000"
  
  ; Create Start Menu shortcut
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  
  ; Create Desktop shortcut
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  
  ; Show completion message with PATH instructions
  MessageBox MB_OK "C9 AI CLI has been installed successfully!$\n$\nTo use from command line:$\n1. Add this folder to your PATH: $INSTDIR$\n2. Or use full path: $INSTDIR\${APP_EXE}$\n$\nStart Menu shortcuts have been created."
  
SectionEnd

; Uninstaller section
Section "Uninstall"
  ; Remove files
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  
  ; Remove Start Menu shortcuts
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"  
  Delete "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"
  
  ; Remove Desktop shortcut
  Delete "$DESKTOP\${APP_NAME}.lnk"
  
  ; Remove from Add/Remove Programs
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
  
SectionEnd