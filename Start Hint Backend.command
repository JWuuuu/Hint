#!/bin/zsh
set -e
cd "$(dirname "$0")"

hint_node_bin="$(command -v node || true)"
if [[ -z "$hint_node_bin" ]]; then
  hint_node_bin="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$hint_node_bin" ]]; then
  echo "Node.js is required to start the Hint backend."
  exit 1
fi
"$hint_node_bin" scripts/start_hint_backend.mjs
