@echo off
setlocal

title Vaxx Dev

pushd %~dp0\..

:: Get electron, compile, built-in extensions
if "%VAXX_SKIP_PRELAUNCH%"=="" node build/lib/preLaunch.js

for /f "tokens=2 delims=:," %%a in ('findstr /R /C:"\"nameShort\":.*" product.json') do set NAMESHORT=%%~a
set NAMESHORT=%NAMESHORT: "=%
set NAMESHORT=%NAMESHORT:"=%.exe
set CODE=".build\electron\%NAMESHORT%"

:: Configuration
set NODE_ENV=development
set VAXX_DEV=1
set ELECTRON_ENABLE_LOGGING=1
set ELECTRON_ENABLE_STACK_DUMPING=1

:: Launch Code
%CODE% . %*
goto end

:end

popd

endlocal
