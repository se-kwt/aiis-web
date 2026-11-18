#!/bin/sh
# Serve site/ on http://localhost:4173 (used by capture/measure for --target aiis).
cd "$(dirname "$0")/../site" && exec python3 -m http.server 4173
