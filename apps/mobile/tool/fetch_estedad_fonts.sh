#!/usr/bin/env bash
set -euo pipefail

FONT_COMMIT="69e879f78a4a1c7c4594baf7da13ba1c9f65ffd3"
FONT_BASE="https://raw.githubusercontent.com/aminabedi68/Estedad/${FONT_COMMIT}/fonts/ttf"
FONT_DIR="assets/fonts"

mkdir -p "${FONT_DIR}"

fonts=(
  "Estedad-Light.ttf"
  "Estedad-Regular.ttf"
  "Estedad-Medium.ttf"
  "Estedad-SemiBold.ttf"
  "Estedad-Bold.ttf"
  "Estedad-ExtraBold.ttf"
  "Estedad-Black.ttf"
)

for font in "${fonts[@]}"; do
  echo "Fetching ${font}"
  curl --fail --location --silent --show-error --retry 3 \
    "${FONT_BASE}/${font}" \
    --output "${FONT_DIR}/${font}"
  test -s "${FONT_DIR}/${font}"
done

echo "Estedad fonts ready from pinned upstream commit ${FONT_COMMIT}."
