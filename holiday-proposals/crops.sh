#!/usr/bin/env bash
# crops.sh <holiday>  close-ups of each dog's head and neck for one holiday, into shots/<holiday>-<dog>.png
cd "$(dirname "$0")"
P=stand,up,sniff,bark,held,sweater,run
./shot.sh "sheet.html?h=$1&dog=z&zoom=5&poses=$P&crop=0.38,0.1,0.62,0.6" shots/$1-z.png 1500,1200
./shot.sh "sheet.html?h=$1&dog=f&zoom=6&poses=$P&crop=0.38,0,0.62,0.8" shots/$1-f.png 1500,1300
./shot.sh "sheet.html?h=$1&dog=m&zoom=7&poses=$P&crop=0.35,0,0.65,0.75" shots/$1-m.png 1500,1300
