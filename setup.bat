@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo   KlipViral AI - Engine Setup
echo ============================================

if not exist bin mkdir bin

if not exist bin\yt-dlp.exe (
  echo [1/3] Downloading yt-dlp...
  curl -L --retry 3 -o bin\yt-dlp.exe "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
) else (
  echo [1/3] yt-dlp already installed.
)

if not exist bin\deno.exe (
  echo [2/3] Downloading Deno runtime...
  curl -L --retry 3 -o deno_tmp.zip "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip"
  tar -xf deno_tmp.zip -C bin
  del deno_tmp.zip
) else (
  echo [2/3] Deno already installed.
)

if not exist bin\ffmpeg.exe (
  echo [3/3] Downloading FFmpeg (large, ~170MB)...
  curl -L --retry 3 -o ffmpeg_tmp.zip "https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip"
  tar -xf ffmpeg_tmp.zip --strip-components=2 -C bin "*/bin/ffmpeg.exe"
  del ffmpeg_tmp.zip
) else (
  echo [3/3] FFmpeg already installed.
)

echo.
echo Installing npm dependencies...
call npm install --no-audit --no-fund

echo.
echo ============================================
echo   Setup complete! Run: npm run dev
echo   Then open http://localhost:3000
echo ============================================
pause