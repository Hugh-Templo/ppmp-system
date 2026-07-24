; PPMP System — Inno Setup script
; Prerequisites on build PC:
;   1. Run: powershell -ExecutionPolicy Bypass -File installer\scripts\prepare-runtime.ps1
;   2. Install Inno Setup 6 (https://jrsoftware.org/isinfo.php)
;   3. Compile this script (ISCC.exe ppmp-setup.iss)
;
; On target PC: install PostgreSQL + create database first, then run Setup.exe as Administrator.

#define MyAppName "PPMP System"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Ormoc City Government"
#define MyAppExeName "PPMP System.exe"

[Setup]
AppId={{A7C3E8F1-9B2D-4E6A-8F01-2C4D6E8A0B12}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist-installer
OutputBaseFilename=PPMP-System-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\ui\{#MyAppExeName}
InfoBeforeFile=INFOBEFORE.txt
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Payload staged by prepare-runtime.ps1 (must exist before compile)
Source: "payload\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\ui\{#MyAppExeName}"; WorkingDir: "{app}\ui"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\ui\{#MyAppExeName}"; WorkingDir: "{app}\ui"; Tasks: desktopicon
Name: "{group}\Configure rclone"; Filename: "{app}\tools\rclone\rclone.exe"; Parameters: "config"; WorkingDir: "{app}\tools\rclone"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Configure-Install.ps1"" -InstallDir ""{app}"" -Port {code:GetApiPort} -DatabaseUrl ""{code:GetDatabaseUrl}"""; \
  StatusMsg: "Configuring API port, database, and Windows service..."; \
  Flags: runhidden waituntilterminated
Filename: "{app}\ui\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Uninstall-Service.ps1"" -InstallDir ""{app}"""; \
  Flags: runhidden waituntilterminated; RunOnceId: "StopPPMPAPI"

[Code]
var
  ConfigPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  ConfigPage := CreateInputQueryPage(wpSelectDir,
    'API and database',
    'PostgreSQL must already be installed on this computer.',
    'Enter the API port (service will listen forever on this port) and the PostgreSQL connection URL, then click Next to continue installing.');
  ConfigPage.Add('API port:', False);
  ConfigPage.Add('DATABASE_URL:', False);
  ConfigPage.Values[0] := '8000';
  ConfigPage.Values[1] := 'postgresql://postgres:postgres@localhost:5432/ppmpbacdb';
end;

function GetApiPort(Param: String): String;
begin
  Result := Trim(ConfigPage.Values[0]);
end;

function GetDatabaseUrl(Param: String): String;
begin
  Result := Trim(ConfigPage.Values[1]);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  PortStr: String;
  PortNum: Integer;
begin
  Result := True;
  if CurPageID = ConfigPage.ID then
  begin
    PortStr := Trim(ConfigPage.Values[0]);
    PortNum := StrToIntDef(PortStr, -1);
    if (PortNum < 1) or (PortNum > 65535) then
    begin
      MsgBox('API port must be a number between 1 and 65535.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if Trim(ConfigPage.Values[1]) = '' then
    begin
      MsgBox('DATABASE_URL is required.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
end;
