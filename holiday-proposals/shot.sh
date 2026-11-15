#!/usr/bin/env bash
# shot.sh <page-with-query> <out.png> <width,height>   headless screenshot of a page in this folder
cd "$(dirname "$0")"
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size="$3" --screenshot="$(cygpath -w "$PWD/$2")" "file:///$(cygpath -m "$PWD")/$1" 2>/dev/null
