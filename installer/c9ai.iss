; Inno Setup script for c9ai — per-user install, no admin required.
; Compile via build-installer.ps1 (passes /DAppVersion=x.y.z).

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{8F3C9A1D-7E42-4B6B-9C2E-C9A1B4D5E6F7}
AppName=c9ai
AppVersion={#AppVersion}
AppPublisher=Knobly
AppPublisherURL=https://github.com/hebbarp/c9ai
DefaultDirName={localappdata}\Programs\c9ai
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=output
OutputBaseFilename=c9ai-setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
ChangesEnvironment=yes
WizardStyle=modern
UninstallDisplayName=c9ai — local-first AI CLI

[Files]
Source: "staging\app\*"; DestDir: "{app}\app"; Flags: recursesubdirs ignoreversion
Source: "staging\runtime\node.exe"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "c9ai.cmd"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{userprograms}\c9ai"; Filename: "{app}\c9ai.cmd"; WorkingDir: "{userdocs}"
Name: "{userdesktop}\c9ai"; Filename: "{app}\c9ai.cmd"; WorkingDir: "{userdocs}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Registry]
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; \
  ValueData: "{olddata};{app}"; Check: NeedsAddPath(ExpandConstant('{app}'))

[Run]
Filename: "{app}\c9ai.cmd"; Description: "Launch c9ai now"; Flags: postinstall shellexec skipifsilent

[Code]
function NeedsAddPath(Param: string): boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', OrigPath) then
  begin
    Result := True;
    exit;
  end;
  { look for the path with leading and trailing semicolon; Pos() returns 0 if not found }
  Result := Pos(';' + Uppercase(Param) + ';', ';' + Uppercase(OrigPath) + ';') = 0;
end;
