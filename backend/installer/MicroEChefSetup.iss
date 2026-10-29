; Micro E-Chef fresh-install setup.
; Open this script in Inno Setup and click Compile. The preprocessor builds the
; backend EXE on the DEVELOPER PC first. The customer PC needs no Node/npm.
; This setup is deliberately fresh-install only; it will not migrate or delete
; an existing node-windows service or a previous backend folder.

#define BackendDir AddBackslash(SourcePath) + ".."
#define BackendBuildCmd AddBackslash(BackendDir) + "exe-build\build-for-setup.cmd"
#if Exec(BackendBuildCmd, "", BackendDir, 1) != 0
  #error Backend EXE build failed. Check %TEMP%\MicroEChef-backend-build.log and install Node.js 24 x64.
#endif

[Setup]
AppId={{E50C4E86-7A84-441D-86F0-DAB8BD1D9A2E}
AppName=MicroE-Chef Backend
AppVersion=1.0
DefaultDirName={autopf}\MicroEChefBackend
DefaultGroupName=MicroE-Chef Backend
OutputDir=..\dist\installer
OutputBaseFilename=MicroEChef_Backend_Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
CloseApplications=yes
SetupLogging=yes
UninstallLogging=yes

[Dirs]
; Hidden is only a visibility setting, not an access-control boundary.
Name: "{app}"; Attribs: hidden
; Logs are deliberately outside the hidden application folder and survive uninstall.
Name: "{commondocs}\MicroEChefBackend\Logs"; Permissions: users-readexec system-full; Flags: uninsneveruninstall

[Files]
; Only the compiled backend and a real Windows-service host are installed.
Source: "{#BackendDir}\dist\chef.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "vendor\WinSW.NET461.exe"; DestDir: "{app}"; DestName: "MicroEChefService.exe"; Flags: ignoreversion
Source: "vendor\WinSW-LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "{tmp}\DbProtector.dll"; DestDir: "{app}"; Flags: external ignoreversion
Source: "{tmp}\MicroEChefService.xml"; DestDir: "{app}"; Flags: external ignoreversion
; C# helper sources are extracted to Setup's temporary folder only.
Source: "{#BackendDir}\Encryptor.cs"; Flags: dontcopy
Source: "{#BackendDir}\template.cs"; Flags: dontcopy

[Code]
const
  NewServiceId = 'MicroEChefBackend';
  LegacyServiceId = 'micro_e_chef_backend.exe';
  OurUninstallKey = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{E50C4E86-7A84-441D-86F0-DAB8BD1D9A2E}_is1';
  TcpFirewallRule = 'MicroEChef Backend TCP';
  MdnsFirewallRule = 'MicroEChef mDNS (UDP 5353)';

var
  DataPage: TWizardPage;
  EditServer: TNewEdit;
  EditUser: TNewEdit;
  EditDb: TNewEdit;
  EditGroqKey: TNewEdit;
  EditPort: TNewEdit;
  PostInstallFailure: String;

procedure InitializeWizard();
var
  LblServer, LblUser, LblDb, LblGroq, LblPort: TLabel;
begin
  DataPage := CreateCustomPage(wpSelectDir, 'Database & System Configuration',
    'Enter the SQL Server, Groq API key and system configuration.');

  LblServer := TLabel.Create(DataPage);
  with LblServer do begin Parent := DataPage.Surface; Caption := 'Database Server:'; Top := 5; end;
  EditServer := TNewEdit.Create(DataPage);
  with EditServer do begin Parent := DataPage.Surface; Top := 20; Width := 400; Text := ''; end;

  LblUser := TLabel.Create(DataPage);
  with LblUser do begin Parent := DataPage.Surface; Caption := 'Database User:'; Top := 45; end;
  EditUser := TNewEdit.Create(DataPage);
  with EditUser do begin Parent := DataPage.Surface; Top := 60; Width := 400; Text := 'MMREST'; end;

  LblDb := TLabel.Create(DataPage);
  with LblDb do begin Parent := DataPage.Surface; Caption := 'Database Name:'; Top := 85; end;
  EditDb := TNewEdit.Create(DataPage);
  with EditDb do begin Parent := DataPage.Surface; Top := 100; Width := 400; Text := 'MMRESTAURANT'; end;

  LblGroq := TLabel.Create(DataPage);
  with LblGroq do begin Parent := DataPage.Surface; Caption := 'Groq API Key (AI Engine):'; Top := 125; end;
  EditGroqKey := TNewEdit.Create(DataPage);
  with EditGroqKey do begin Parent := DataPage.Surface; Top := 140; Width := 400; Text := 'gsk_...'; end;

  LblPort := TLabel.Create(DataPage);
  with LblPort do begin Parent := DataPage.Surface; Caption := 'Application Port:'; Top := 165; end;
  EditPort := TNewEdit.Create(DataPage);
  with EditPort do begin Parent := DataPage.Surface; Top := 180; Width := 100; Text := '3000'; end;
end;

function FindCscPath(): String;
begin
  Result := ExpandConstant('{win}\Microsoft.NET\Framework64\v4.0.30319\csc.exe');
  if not FileExists(Result) then
    Result := ExpandConstant('{win}\Microsoft.NET\Framework\v4.0.30319\csc.exe');
  if not FileExists(Result) then Result := '';
end;

procedure RunChecked(const FileName, Parameters, WorkingDir, Description: String);
var
  ResultCode: Integer;
begin
  if not ExecAndLogOutput(FileName, Parameters, WorkingDir, SW_SHOWNORMAL, ewWaitUntilTerminated, ResultCode, nil) then
    RaiseException(Description + ' could not start. Windows error: ' + IntToStr(ResultCode));
  if ResultCode <> 0 then
    RaiseException(Description + ' failed. Exit code: ' + IntToStr(ResultCode));
end;

function ReadEncryptedLine(const OutputPath: String; LineIndex: Integer): String;
var
  Lines: TArrayOfString;
begin
  Result := '';
  if LoadStringsFromFile(OutputPath, Lines) then
    if (LineIndex >= 1) and (LineIndex <= GetArrayLength(Lines)) then
      Result := Lines[LineIndex - 1];
end;

procedure ReplacePlaceholder(var Lines: TArrayOfString; const Token, Value: String);
var
  Index, Count: Integer;
begin
  Count := 0;
  for Index := 0 to GetArrayLength(Lines) - 1 do
    Count := Count + StringChangeEx(Lines[Index], Token, Value, True);
  if Count = 0 then RaiseException('Missing placeholder in template.cs: ' + Token);
end;

procedure GenerateConfigDll();
var
  CscPath, EncCsPath, EncExePath, InputPath, OutputPath, CsPath, DllPath: String;
  EncServer, EncUser, EncPass, EncDb, EncJwt, EncPort, EncGroqKey: String;
  PlainLines, TemplateLines: TArrayOfString;
begin
  CscPath := FindCscPath();
  if CscPath = '' then RaiseException('The .NET Framework C# compiler was not found.');
  ExtractTemporaryFile('Encryptor.cs');
  ExtractTemporaryFile('template.cs');
  EncCsPath := ExpandConstant('{tmp}\Encryptor.cs');
  EncExePath := ExpandConstant('{tmp}\Encryptor.exe');
  InputPath := ExpandConstant('{tmp}\enc_input.txt');
  OutputPath := ExpandConstant('{tmp}\enc_output.txt');
  CsPath := ExpandConstant('{tmp}\DbProtector.cs');
  DllPath := ExpandConstant('{tmp}\DbProtector.dll');

  try
    SetArrayLength(PlainLines, 7);
    PlainLines[0] := EditServer.Text;
    PlainLines[1] := EditUser.Text;
    // These two fixed values preserve the behaviour of the supplied installer.
    // They are not secret from someone who can inspect the installer or source.
    PlainLines[2] := 'SPEC';
    PlainLines[3] := EditDb.Text;
    PlainLines[4] := 'restaurant_secret_2026';
    PlainLines[5] := EditPort.Text;
    PlainLines[6] := EditGroqKey.Text;
    if not SaveStringsToUTF8File(InputPath, PlainLines, False) then
      RaiseException('Could not save the temporary installer configuration.');

    RunChecked(CscPath, '/nologo /target:exe /out:"' + EncExePath + '" "' + EncCsPath + '"', '', 'Encryptor compilation');
    RunChecked(EncExePath, '"' + InputPath + '" "' + OutputPath + '"', '', 'Configuration encryption');
    EncServer := ReadEncryptedLine(OutputPath, 1);
    EncUser := ReadEncryptedLine(OutputPath, 2);
    EncPass := ReadEncryptedLine(OutputPath, 3);
    EncDb := ReadEncryptedLine(OutputPath, 4);
    EncJwt := ReadEncryptedLine(OutputPath, 5);
    EncPort := ReadEncryptedLine(OutputPath, 6);
    EncGroqKey := ReadEncryptedLine(OutputPath, 7);
    if (EncServer = '') or (EncUser = '') or (EncPass = '') or (EncDb = '') or
       (EncJwt = '') or (EncPort = '') or (EncGroqKey = '') then
      RaiseException('Configuration encryption did not return all expected values.');

    if not LoadStringsFromFile(ExpandConstant('{tmp}\template.cs'), TemplateLines) then
      RaiseException('Could not load the DLL template.');
    ReplacePlaceholder(TemplateLines, '#DB_SERVER#', EncServer);
    ReplacePlaceholder(TemplateLines, '#DB_USER#', EncUser);
    ReplacePlaceholder(TemplateLines, '#DB_PASS#', EncPass);
    ReplacePlaceholder(TemplateLines, '#DB_NAME#', EncDb);
    ReplacePlaceholder(TemplateLines, '#REMARKS_DB_SERVER#', EncServer);
    ReplacePlaceholder(TemplateLines, '#REMARKS_DB_USER#', EncUser);
    ReplacePlaceholder(TemplateLines, '#REMARKS_DB_PASS#', EncPass);
    ReplacePlaceholder(TemplateLines, '#REMARKS_DB_NAME#', EncDb);
    ReplacePlaceholder(TemplateLines, '#JWT_SECRET#', EncJwt);
    ReplacePlaceholder(TemplateLines, '#PORT#', EncPort);
    ReplacePlaceholder(TemplateLines, '#GROQ_API_KEY#', EncGroqKey);
    if not SaveStringsToUTF8File(CsPath, TemplateLines, False) then
      RaiseException('Could not write the temporary DLL source.');
    RunChecked(CscPath, '/nologo /target:library /out:"' + DllPath + '" "' + CsPath + '"', '', 'Database configuration DLL compilation');
    if not FileExists(DllPath) then RaiseException('DbProtector.dll was not created.');
  finally
    DeleteFile(InputPath);
    DeleteFile(OutputPath);
    DeleteFile(CsPath);
    DeleteFile(EncExePath);
    DeleteFile(EncCsPath);
    DeleteFile(ExpandConstant('{tmp}\template.cs'));
  end;
end;

function XmlEscape(const Value: String): String;
begin
  Result := Value;
  StringChangeEx(Result, '&', '&amp;', True);
  StringChangeEx(Result, '<', '&lt;', True);
  StringChangeEx(Result, '>', '&gt;', True);
  StringChangeEx(Result, '"', '&quot;', True);
  StringChangeEx(Result, '''', '&apos;', True);
end;

procedure WriteServiceConfig();
var
  Lines: TArrayOfString;
  LogDir, ConfigPath: String;
begin
  LogDir := ExpandConstant('{commondocs}\MicroEChefBackend\Logs');
  // The [Dirs] section creates the log directory during installation.
  ConfigPath := ExpandConstant('{tmp}\MicroEChefService.xml');
  SetArrayLength(Lines, 15);
  Lines[0] := '<?xml version="1.0" encoding="UTF-8"?>';
  Lines[1] := '<service>';
  Lines[2] := '  <id>' + NewServiceId + '</id>';
  Lines[3] := '  <name>MICRO_E_CHEF_BACKEND</name>';
  Lines[4] := '  <description>Micro E Chef Restaurant POS Backend</description>';
  Lines[5] := '  <executable>%BASE%\chef.exe</executable>';
  Lines[6] := '  <workingdirectory>%BASE%</workingdirectory>';
  Lines[7] := '  <startmode>Automatic</startmode>';
  Lines[8] := '  <env name="NODE_ENV" value="production" />';
  Lines[9] := '  <logpath>' + XmlEscape(LogDir) + '</logpath>';
  Lines[10] := '  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>8</keepFiles></log>';
  Lines[11] := '  <onfailure action="restart" delay="10 sec" />';
  Lines[12] := '  <resetfailure>1 hour</resetfailure>';
  Lines[13] := '</service>';
  Lines[14] := '';
  if not SaveStringsToUTF8File(ConfigPath, Lines, False) then
    RaiseException('Could not write the service configuration.');
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  PortNumber: Integer;
begin
  Result := '';
  if RegKeyExists(HKLM, OurUninstallKey) then
  begin
    Result := 'This setup is already registered on this PC. It supports fresh installations only. Uninstall MicroE-Chef Backend before trying again.';
    Exit;
  end;
  if RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\' + NewServiceId) or
     RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\' + LegacyServiceId) then
  begin
    Result := 'A Micro E-Chef backend service is already installed. This setup supports fresh installations only. Uninstall the old service first, or use a clean test PC.';
    Exit;
  end;
  if FileExists(ExpandConstant('{app}\server.js')) or
     FileExists(ExpandConstant('{app}\node.exe')) or
     FileExists(ExpandConstant('{app}\chef.exe')) or
     FileExists(ExpandConstant('{app}\DbProtector.dll')) or
     FileExists(ExpandConstant('{app}\MicroEChefService.exe')) or
     FileExists(ExpandConstant('{app}\MicroEChefService.xml')) or
     DirExists(ExpandConstant('{app}\node_modules')) then
  begin
    Result := 'The selected folder contains a previous backend installation. Choose a clean folder. Setup has not deleted or changed the old files.';
    Exit;
  end;
  if not IsDotNetInstalled(net462, 0) or (FindCscPath() = '') then
  begin
    Result := '.NET Framework 4.6.2 or later and the Framework C# compiler are required.';
    Exit;
  end;
  if not FileExists(ExpandConstant('{sys}\vcruntime140.dll')) then
  begin
    Result := 'Install the Microsoft Visual C++ Redistributable x64 before continuing.';
    Exit;
  end;
  if (Trim(EditServer.Text) = '') or (Trim(EditUser.Text) = '') or (Trim(EditDb.Text) = '') then
  begin
    Result := 'Enter the database server, user and database name.';
    Exit;
  end;
  PortNumber := StrToIntDef(Trim(EditPort.Text), 0);
  if (PortNumber < 1) or (PortNumber > 65535) then
  begin
    Result := 'Application Port must be a number between 1 and 65535.';
    Exit;
  end;
  EditPort.Text := IntToStr(PortNumber);
  // Do all machine-specific compilation before copying any installed files.
  // Setup stops on failure instead of reporting a successful installation.
  try
    GenerateConfigDll();
    WriteServiceConfig();
  except
    Result := 'Could not prepare the database configuration: ' + GetExceptionMessage + #13#10 +
      'No application files were installed. See the Setup log in your temporary folder.';
    Log(Result);
  end;
end;


function ConfigureFirewall(): Boolean;
var
  Netsh: String;
  Code: Integer;
  TcpOk, MdnsOk: Boolean;
begin
  Netsh := ExpandConstant('{sys}\netsh.exe');
  // Replace only the rules owned by this setup; the port has already been validated.
  Exec(Netsh, 'advfirewall firewall delete rule name="' + TcpFirewallRule + '"', '', SW_HIDE, ewWaitUntilTerminated, Code);
  TcpOk := Exec(Netsh, 'advfirewall firewall add rule name="' + TcpFirewallRule + '" dir=in action=allow protocol=TCP localport=' + EditPort.Text + ' program="' + ExpandConstant('{app}\chef.exe') + '"', '', SW_HIDE, ewWaitUntilTerminated, Code);
  TcpOk := TcpOk and (Code = 0);
  MdnsOk := Exec(Netsh, 'advfirewall firewall show rule name="' + MdnsFirewallRule + '"', '', SW_HIDE, ewWaitUntilTerminated, Code);
  MdnsOk := MdnsOk and (Code = 0);
  if not MdnsOk then
  begin
    MdnsOk := Exec(Netsh, 'advfirewall firewall add rule name="' + MdnsFirewallRule + '" dir=in action=allow protocol=UDP localport=5353', '', SW_HIDE, ewWaitUntilTerminated, Code);
    MdnsOk := MdnsOk and (Code = 0);
  end;
  Result := TcpOk and MdnsOk;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ServiceExe: String;
  IgnoredCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    // DLL and XML were generated before file copying; only now start WinSW.
    ServiceExe := ExpandConstant('{app}\MicroEChefService.exe');
    try
      RunChecked(ServiceExe, 'install', ExpandConstant('{app}'), 'Service installation');
      RunChecked(ServiceExe, 'start', ExpandConstant('{app}'), 'Service start');
    except
      // ssPostInstall exceptions do not make Inno fail automatically. Clean up
      // a possibly-created service, report incomplete installation and return a
      // nonzero exit code; keep the uninstaller so the files can be removed.
      PostInstallFailure := GetExceptionMessage;
      Log('Backend service setup failed: ' + PostInstallFailure);
      Exec(ServiceExe, 'stopwait', ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, IgnoredCode);
      Exec(ServiceExe, 'uninstall', ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, IgnoredCode);
      SuppressibleMsgBox('Installation is incomplete: ' + PostInstallFailure + #13#10#13#10 +
        'Uninstall MicroE-Chef Backend before retrying. Check the Setup log, Windows Application event log and backend log folder.',
        mbError, MB_OK, IDOK);
      Exit;
    end;
    if not ConfigureFirewall() then
      SuppressibleMsgBox('The backend service was installed, but a firewall rule could not be configured. Check Windows Firewall before connecting a phone.', mbError, MB_OK, IDOK);
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = wpFinished) and (PostInstallFailure <> '') then
  begin
    WizardForm.FinishedHeadingLabel.Caption := 'Installation incomplete';
    WizardForm.FinishedLabel.Caption :=
      'The service could not be installed and started. Uninstall MicroE-Chef Backend before retrying, and check the Setup log.';
  end;
end;

function GetCustomSetupExitCode(): Integer;
begin
  if PostInstallFailure <> '' then Result := 10 else Result := 0;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Code: Integer;
  ServiceExe, Failure: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    // WinSW v2 `stop` only requests a stop; `stopwait` waits for SCM to report
    // Stopped. Do not remove the files if stopping/unregistering fails.
    if RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\' + NewServiceId) then
    begin
      ServiceExe := ExpandConstant('{app}\MicroEChefService.exe');
      try
        if not FileExists(ServiceExe) or not FileExists(ExpandConstant('{app}\MicroEChefService.xml')) then
          RaiseException('The service wrapper or its XML configuration is missing.');
        RunChecked(ServiceExe, 'stopwait', ExpandConstant('{app}'), 'Service stop');
        RunChecked(ServiceExe, 'uninstall', ExpandConstant('{app}'), 'Service removal');
      except
        Failure := GetExceptionMessage;
        Log('Uninstall cannot safely remove the backend service: ' + Failure);
        SuppressibleMsgBox('Uninstall stopped because the backend service could not be removed: ' + Failure + #13#10#13#10 +
          'The application files were left in place. Check the Uninstall log or Windows Services and retry.', mbError, MB_OK, IDOK);
        Abort;
      end;
    end;
  end;
  if CurUninstallStep = usPostUninstall then
  begin
    Exec(ExpandConstant('{sys}\netsh.exe'), 'advfirewall firewall delete rule name="' + TcpFirewallRule + '"', '', SW_HIDE, ewWaitUntilTerminated, Code);
    Exec(ExpandConstant('{sys}\netsh.exe'), 'advfirewall firewall delete rule name="' + MdnsFirewallRule + '"', '', SW_HIDE, ewWaitUntilTerminated, Code);
    // The log directory is intentionally preserved.
  end;
end;
