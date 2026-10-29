# Micro E-Chef — Inno Setup මඟින් backend installer එක build කිරීම

මෙය දැනට ඇති `Resturant` project එකට යොදන **project-file වෙනස්කම්** වේ. වෙනම සාදා දුන් backend EXE එකක් අවශ්‍ය නැහැ. Inno Setup script එක compile කරන විට backend EXE එකත් ස්වයංක්‍රීයව build වී, එය ඇතුළත් setup installer එක සෑදේ.

> **Fresh installations පමණයි.** මේ setup එක පැරණි `node-windows` service එක migrate හෝ delete කරන්නේ නැහැ. දැනට service එකක්, මෙම setup එකේ registration එකක් හෝ තෝරාගත් folder එකේ පැරණි backend files තිබේ නම් setup නතර වේ. මුලින් වෙනම test PC එකක් භාවිත කරන්න.

## 1. Project එක සකස් කිරීම

දැනට පවතින project එක backup කර, ලබා දී ඇති `backend` files එකම folder structure එකට merge කරන්න. ඔබගේ `server.js` හෝ `package.json` දැනට වෙනස් නම් අන්ධව overwrite නොකර වෙනස්කම් merge කරන්න. මෙය සම්පූර්ණ project එක නොවේ: ඔබගේ මුල් project එකේ `backend\Encryptor.cs`, `backend\package-lock.json` සහ `backend\routes\aiReport.js` ද අවශ්‍යයි.

වැදගත් වෙනස් වූ files:

- `backend\server.js`, `backend\package.json`, `backend\template.cs`
- `backend\exe-build\` — isolated EXE build configuration සහ build hook
- `backend\installer\MicroEChefSetup.iss` — Inno Setup script
- `backend\installer\vendor\WinSW.NET461.exe` සහ `WinSW-LICENSE.txt` — Windows service wrapper සහ එහි MIT license. මෙය backend EXE එක **නොවේ**.

## 2. Developer PC එකේ setup එක compile කිරීම

අවශ්‍ය වන්නේ Windows x64 build PC එකක්, **Node.js 24 x64 + npm**, Inno Setup 6.7.3, internet access සහ ප්‍රමාණවත් නිදහස් disk space ය. Node install කිරීමෙන් පසු Inno Setup නැවත විවෘත කරන්න, එවිට `node` සහ `npm` එහි PATH එකට ලැබේ.

1. `backend\installer\MicroEChefSetup.iss` Inno Setup Compiler එකෙන් විවෘත කරන්න.
2. **Build → Compile** තෝරන්න. මෙය `backend\exe-build\build-for-setup.cmd` හරහා backend එක ස්වයංක්‍රීයව build කරයි. පළමු build එකේ dependencies සහ base binary download වන බැවින් මිනිත්තු කිහිපයක් ගත විය හැක.
3. Compile සාර්ථක වූ පසු customer ට ලබා දිය යුත්තේ මෙයයි:

   ```text
   backend\dist\installer\MicroEChef_Backend_Setup.exe
   ```

   `backend\dist\chef.exe` developer PC එකේ build අතරමැදි output එකක් ලෙස තිබේ. එය customer ට වෙනම යැවීමට හෝ install කිරීමට අවශ්‍ය නැහැ. Build එක අසාර්ථක නම් Inno compile එකත් නවතී; පැරණි EXE එකක් නිහඬව ඇතුළත් නොකරයි. Build විස්තර `%TEMP%\MicroEChef-backend-build.log` හි බලන්න.

Build script එක temporary folder එකක locked runtime dependencies install කරයි; සාමාන්‍ය `backend\node_modules` වෙනස් නොකරයි. Project එකේ `.env` හෝ දැනට තිබෙන `DbProtector.dll` package නොකරයි. `chef.exe` නම් වෙනස් නොකරන්න: native `edge-js` addon එක ඒ නමට ගැළපෙන ලෙස සකසා ඇත.

## 3. Customer PC එකේ installation

අවශ්‍යතා: **Windows 10 / Windows Server 2016 හෝ පසුව ඇති x64 Windows**, administrator අවසරය, .NET Framework **4.6.2 හෝ පසුව ඇති compatible version එකක්** සහ එහි C# compiler, Microsoft Visual C++ Redistributable **x64**. Setup එක ඇතැම් prerequisites පරීක්ෂා කරන නමුත් runtime file එකක් පවතිනවාදැයි පරීක්ෂා කිරීම පමණක් සම්පූර්ණ runtime compatibility සහතික කිරීමක් නොවේ. Customer PC එකේ Node.js/npm අවශ්‍ය නැහැ. ARM64 emulation පරීක්ෂා කර නැහැ.

Installer wizard එකේ SQL Server, database user, database name, Groq API key සහ port දෙන්න. මුල් script එකේ හැසිරීම රැකීමට SQL password සහ JWT secret තවමත් `.iss` තුළ fixed values ලෙස ඇත; wizard එකෙන් ඒවා අසන්නේ නැහැ. **ඔබගේ වත්මන් mobile app code එක port `3000` hard-code කර ඇත**, එබැවින් mobile app එකත් වෙනස් නොකර installer port එක වෙනස් නොකරන්න.

Setup එක configuration inputs අනුව `DbProtector.dll` සහ service XML ජනනය කරයි; ඉන් පසුව පමණක් WinSW service එක install/start කරයි. අලුත් service ID එක `MicroEChefBackend`; Services හි display name එක `MICRO_E_CHEF_BACKEND` ය. එය LocalSystem යටතේ ක්‍රියා කරයි. DLL config වෙනස් කිරීමෙන් පසු service restart අවශ්‍යයි. පැරණි `install-service.js` / `uninstall-service.js` තවමත් `server.js` සඳහා වන node-windows scripts ය; අලුත් installer එක සමඟ ඒවා භාවිත නොකරන්න.

ස්ථාපිත folder එක සාමාන්‍යයෙන් `C:\Program Files\MicroEChefBackend` සහ hidden ලෙස සලකුණු කර ඇත. එහි `chef.exe`, machine configuration සඳහා වෙනම `DbProtector.dll`, `MicroEChefService.exe`, `MicroEChefService.xml`, WinSW license සහ uninstaller තිබේ. Backend `.js` source tree, `.env` හෝ `node_modules` එහි copy නොවේ. Native addon එක ක්‍රියාත්මක වන විට service account එකට ලිවිය හැකි temporary/cache location එකක් අවශ්‍ය වේ.

Setup එක TCP application port එකට inbound firewall rule එකක් සහ compatibility සඳහා UDP 5353 rule එකක් සාදයි. TCP rule එක application EXE එකට සීමා කළත් default ලෙස සියලු network profiles සඳහා වේ; public networks සඳහා ඔබගේ security policy අනුව සීමා කරන්න. මෙම mobile project එක backend IP manually/saved ලෙස භාවිත කරයි; mDNS discovery එකක් මෙහි පරීක්ෂා කළ code එකේ නැහැ.

## 4. Logs සහ අසාර්ථක installations

Backend logs සාමාන්‍යයෙන් මෙහි තිබේ (`Public Documents` Windows හි වෙනස් තැනකට යොමු කර ඇත්නම් එම location එක භාවිත වේ):

```text
C:\Users\Public\Documents\MicroEChefBackend\Logs\
  MicroEChefService.out.log
  MicroEChefService.err.log
  MicroEChefService.wrapper.log
```

ඒවා hidden app folder එකෙන් පිටත තිබෙන අතර uninstall කිරීමෙන් පසුවත් තබා ගනී. Setup diagnostics සඳහා customer PC එකේ `%TEMP%` හි `Setup Log ...` file එක බලන්න. Uninstall log ද Add/Remove Programs මඟින් uninstall කරන විට `%TEMP%` හි ලැබේ.

DLL එක සෑදීම අසාර්ථක නම් files copy කිරීමට පෙර setup නවතී. Service install/start අසාර්ථක නම් setup එක **incomplete** බව පෙන්වයි; files සහ uninstaller ඉතිරි විය හැකි නිසා retry කිරීමට පෙර `MicroE-Chef Backend` uninstall කර logs පරීක්ෂා කරන්න. Uninstall එකේ service එක ආරක්ෂිතව stop/remove කළ නොහැකි නම් files ඉවත් නොකර නවතී; Windows Services සහ uninstall log පරීක්ෂා කර නැවත උත්සාහ කරන්න.

## 5. Production පෙර අනිවාර්ය පරීක්ෂාව

වෙනම **සැබෑ Windows x64 PC එකක සහ test database එකක** install, login/API, service stop/start/uninstall සහ reboot කිහිපයක් පරීක්ෂා කරන්න. Backend startup එක notification tables create/alter කළ හැකි නිසා untested installer එක production database එකට යොමු නොකරන්න.

Port `3000` සඳහා:

- PC එකේ `http://127.0.0.1:3000/test` — HTTP backend එකට ළඟා විය හැකිද?
- `http://127.0.0.1:3000/startup-ready` — **පළමු** SQL connection එක ලැබෙන තුරු `503`, ලැබුණු පසු `200`.
- SQL startup වෙද්දී `/api` සඳහා `503`; SQL පසුව ලබා ගත හැකි වුවහොත් backend එක 5/10/20/30-second backoff සහිතව නැවත connect වීමට උත්සාහ කරයි. Request එක app එකෙන් නැවත යැවිය යුතු විය හැක.
- Phone එකෙන් `http://<PC-LAN-IP>:3000/test` සහ login පරීක්ෂා කරන්න. PC එකේ වැඩ කර phone එකේ වැඩ නොකරයි නම් LAN IP, firewall, Wi-Fi isolation පරීක්ෂා කරන්න.

`/startup-ready` අඛණ්ඩ SQL health check එකක් නොවේ. පළමු successful connection එකෙන් පසු SQL දිගු වේලාවක් නැති වීමෙන් pool recovery වීම සහතික කර නැත. Order/billing writes අන්ධව auto-retry නොකරන්න.

මෙහි EXE build, synthetic configuration DLL, installer/service startup, offline-SQL responses සහ uninstall Wine යටතේ පරීක්ෂා කර ඇත. **සැබෑ Windows, සජීවී SQL connection, reboot සහ ඔබගේ පරිසරයේ සියලු features තවමත් පරීක්ෂා කළ යුතුය.** Azure interactive browser authentication සහ packager හි Linux-only `xdg-open` warning මෙම Windows SQL-password flow එකේ පරීක්ෂා කර නැත.

## 6. ආරක්ෂාව සහ maintenance

- Hidden folder එකත් EXE bytecode packaging එකත් source code හෝ credentials සඳහා ශක්තිමත් ආරක්ෂාවක් නොවේ. Config DLL එක wizard values අනුව වෙනස් වුවත් එය OS/TPM එකට cryptographically bound නැත.
- දැනට DLL encryption key/IV සහ installer හි fixed credentials source එකේ තිබේ. Install කරන අතර plaintext values protected temporary folder එකක කෙටි කාලයක් පවතින අතර සාමාන්‍යයෙන් පිරිසිදු කෙරේ. ඇත්ත credentials public වී ඇත්නම් rotate කරන්න; මෙම `.iss` හෝ installer එක public repository එකකට upload නොකරන්න.
- `exe-build\package.json` සහ lock file එකේ dependencies pin කර ඇත. Backend dependencies/routes/assets වෙනස් කළ විට ඒවා සහ `build-exe.cjs` staging list එක update කර නැවත test කරන්න. Third-party dependency license notices distribution කිරීමට පෙර සමාලෝචනය කරන්න. WinSW 2.12.0 MIT license එක මෙහි ඇත.
