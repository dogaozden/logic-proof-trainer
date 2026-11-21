#!/usr/bin/env bash
# Build the browser version: logic-core → WebAssembly (src/web/pkg), then Vite with the web
# invoke shim in place of Tauri's IPC. Output: dist/ (relative paths, hostable in any folder).
set -euo pipefail
cd "$(dirname "$0")/.."
target_dir="${CARGO_TARGET_DIR:-target}"
cargo build -p trainer-wasm --release --target wasm32-unknown-unknown ${CARGO_ARGS:-}
wasm-bindgen --target web --out-dir src/web/pkg \
  "$target_dir/wasm32-unknown-unknown/release/trainer_wasm.wasm"
npx tsc --noEmit
npx vite build --mode web
