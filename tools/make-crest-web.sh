#!/bin/sh
# Regenerate site/assets/logos/crest-web.png: a proportional downscale (longest side 540 px, alpha kept, nothing else changed)
# of the official crest in crest.png. Needs macOS `sips`. Run after replacing crest.png, then `npm run build:single`.
cd "$(dirname "$0")/../site/assets/logos" && exec sips -Z 540 crest.png --out crest-web.png
