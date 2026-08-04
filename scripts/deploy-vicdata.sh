#!/bin/sh
set -eu

STAGE=${1:?用法：deploy-vicdata.sh /home/vicadmin/vicdata-stage-YYYYMMDD-description [需校验的相对文件...]}
shift
STAGE=${STAGE%/}
STAGE_PARENT=${STAGE%/*}
STAGE_NAME=${STAGE##*/}

if [ "$STAGE_PARENT" != "/home/vicadmin" ]; then
  echo "暂存目录必须位于 /home/vicadmin" >&2
  exit 1
fi

case "$STAGE_NAME" in
  vicdata-stage-*) ;;
  *)
    echo "暂存目录名称必须以 vicdata-stage- 开头" >&2
    exit 1
    ;;
esac

ROOT=/var/www/vicdata
TARGET="$ROOT/site"
STAMP=$(date +%Y%m%d-%H%M%S)
PREVIOUS="$ROOT/site.previous-$STAMP"

test -d "$STAGE"
test -f "$STAGE/index.html"
test -f "$STAGE/app/i18n.js"
test -f "$STAGE/locales/ui.en.js"
test -f "$STAGE/versions/1.13.9/data-technologies.js"
test -f "$STAGE/versions/1.13.9/locale-regions.en.js"
grep -Fq 'data-locale="en"' "$STAGE/index.html"
grep -Fq '"terrainRuns":' "$STAGE/versions/1.13.9/map-data.js"
grep -Fq 'stateTraitFilters' "$STAGE/index.html"
test -f "$STAGE/vc/index.html"
test -f "$STAGE/vc/app/i18n.js"
test -f "$STAGE/vc/locales/ui.en.js"
test -f "$STAGE/vc/data-index.js"
test -f "$STAGE/vc/map-data.js"
test -f "$STAGE/vc/victorian-century-config.js"
test -f "$STAGE/vc/assets/map/provinces.png"
grep -Fq 'data-locale="en"' "$STAGE/vc/index.html"
grep -Fq '"terrainRuns":' "$STAGE/vc/map-data.js"
grep -Fq 'stateTraitFilters' "$STAGE/vc/index.html"

for expected_file in "$@"; do
  case "$expected_file" in
    ""|/*|../*|*/../*)
      echo "校验文件必须是站点内的相对路径：$expected_file" >&2
      exit 1
      ;;
  esac
  test -f "$STAGE/$expected_file"
done

if [ -e "$PREVIOUS" ]; then
  echo "回退目录已存在：$PREVIOUS" >&2
  exit 1
fi

if [ -d "$TARGET" ]; then
  mv "$TARGET" "$PREVIOUS"
fi
mv "$STAGE" "$TARGET"

printf 'vicdata deploy complete\nactive=%s\nprevious=%s\n' "$TARGET" "$PREVIOUS"
