@echo off
setlocal
rem Called automatically by Inno Setup at compile time on the developer PC.
rem The customer PC does not need Node or npm.
set "BUILD_LOG=%TEMP%\MicroEChef-backend-build.log"
pushd "%~dp0.."
if errorlevel 1 exit /b 1
rem Inno always reads backend\dist\chef.exe; do not allow an inherited
rem override to make Setup package an older file from a different directory.
set "MICRO_E_CHEF_EXE_OUTPUT_DIR=%CD%\dist"
> "%BUILD_LOG%" echo Building Micro E Chef backend executable...
call npm run build:exe >> "%BUILD_LOG%" 2>&1
set "BUILD_RESULT=%errorlevel%"
popd
exit /b %BUILD_RESULT%
