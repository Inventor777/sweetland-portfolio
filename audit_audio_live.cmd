@echo off
setlocal EnableDelayedExpansion

REM Change this if you want to test a different domain
set "BASE=https://imchloekang.com"

REM Output files
set "OUT=_audio_live_audit.csv"
set "FAIL=_audio_live_fail.csv"
echo http_code;content_type;url;local_file> "%OUT%"
echo http_code;content_type;url;local_file> "%FAIL%"

REM Scan ALL audio-like files under /public (covers ost, sfx, etc.)
for /r "public" %%F in (*.wav *.mp3 *.ogg *.m4a *.aac) do (
  set "abs=%%F"
  set "rel=!abs:%CD%\=!"
  set "web=!rel:\=/!"
  REM strip leading "public/"
  set "web=!web:public/=!"
  if not "!web:~0,1!"=="/" set "web=/!web!"

  set "url=%BASE%!web!"
  REM minimal encoding for spaces (good enough for your current filenames)
  set "url=!url: =%%20!"

  REM Use range request so we only download 1 byte (fast)
  for /f "tokens=1,2 delims=;" %%A in ('
    curl -s -L -r 0-0 -o NUL -w "%%{http_code};%%{content_type}" "!url!"
  ') do (
    set "code=%%A"
    set "ctype=%%B"
    echo !code!;!ctype!;!url!;!abs!>> "%OUT%"

    REM mark failures: not 200/206 OR served as HTML
    echo !ctype! | findstr /i "text/html" >nul
    if !errorlevel! equ 0 (
      echo !code!;!ctype!;!url!;!abs!>> "%FAIL%"
    ) else (
      if not "!code!"=="200" if not "!code!"=="206" (
        echo !code!;!ctype!;!url!;!abs!>> "%FAIL%"
      )
    )
  )
)

echo.
echo Wrote:
echo   %OUT%
echo   %FAIL%
echo.
echo === FAILURES (first 30) ===
for /f "skip=1 tokens=* delims=" %%L in (%FAIL%) do (
  echo %%L
  set /a N+=1
  if !N! GEQ 30 goto :done
)
:done
echo.
echo If you see text/html here, those URLs are being rewritten to index.html (missing/mismatched path or filename).
endlocal
