#!/usr/bin/env bash
# Run a cargo command against a local logic-core checkout (before its tag is published):
#   scripts/local-logic-core.sh ../logic-core cargo build -p trainer-wasm ...
set -euo pipefail
core="$(cd "$1" && pwd)"; shift
export CARGO_NET_GIT_FETCH_WITH_CLI=true
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0="url.file://$core.insteadOf" GIT_CONFIG_VALUE_0="https://github.com/dogaozden/logic-core"
exec "$@"
