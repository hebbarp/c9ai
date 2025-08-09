; C9AI Installer Script for NSIS
; This creates a simple Windows installer

!define APP_NAME "C9 AI CLI"
!define APP_VERSION "2.1.0"
!define APP_PUBLISHER "C9 AI Team"
!define APP_EXE "c9ai-win.exe"

; Include for PATH manipulation
!include "WinMessages.nsh"

; Installer settings
Name "${APP_NAME}"
OutFile "dist\c9ai-installer.exe"
InstallDir "$PROGRAMFILES\C9AI"
RequestExecutionLevel admin

; Pages
Page directory
Page instfiles

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
  
  ; Add to PATH using registry
  ${EnvVarUpdate} $0 "PATH" "A" "HKLM" "$INSTDIR"
  
  ; Create Start Menu shortcut
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  
SectionEnd

; Uninstaller section
Section "Uninstall"
  ; Remove files
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  
  ; Remove from PATH using registry
  ${EnvVarUpdate} $0 "PATH" "R" "HKLM" "$INSTDIR"
  
  ; Remove Start Menu shortcuts
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"
  
  ; Remove from Add/Remove Programs
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
  
SectionEnd

; EnvVarUpdate function to handle PATH manipulation
!define Environ 'HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"'

!macro EnvVarUpdate UN
Function ${UN}EnvVarUpdate
  Push $0
  Exch 4
  Exch $1
  Exch 3
  Exch $2
  Exch 2
  Exch $3
  Exch
  Exch $4
  Push $5
  Push $6
  Push $7
  Push $8
  Push $9
  Push $R0
 
  ; $0 = Action (A=Add, R=Remove)
  ; $1 = RegLoc (HKLM or HKCU)  
  ; $2 = KeyName
  ; $3 = Value to add/remove
  ; $4 = KeyName
 
  ReadRegStr $5 ${Environ} $2
  
  ${If} $0 == "A"
    ; Add to PATH
    ${If} $5 == ""
      WriteRegExpandStr ${Environ} $2 $3
    ${Else}
      StrCmp $5 "" 0 +2
      WriteRegExpandStr ${Environ} $2 $3
      WriteRegExpandStr ${Environ} $2 "$5;$3"
    ${EndIf}
  ${ElseIf} $0 == "R"
    ; Remove from PATH
    ${If} $5 != ""
      StrCpy $6 $5 1 -1
      ${If} $6 == ";"
        StrCpy $5 $5 -1
      ${EndIf}
      StrLen $7 $3
      StrCpy $8 0
      StrCpy $9 $5 $7 $8
      ${If} $9 == $3
        StrCpy $5 $5 $8
        IntOp $8 $8 + $7
        StrCpy $9 $5 1 $8
        ${If} $9 == ";"
          IntOp $8 $8 + 1
          StrCpy $5 $5 "" $8
        ${EndIf}
      ${EndIf}
      WriteRegExpandStr ${Environ} $2 $5
    ${EndIf}
  ${EndIf}
  
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
 
  Pop $R0
  Pop $9
  Pop $8
  Pop $7
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd
!macroend

!insertmacro EnvVarUpdate ""