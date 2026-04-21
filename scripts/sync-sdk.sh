#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK_SRC="$REPO_ROOT/sdk"
TARGETS=(
  "$REPO_ROOT/server/src/sdk"
  "$REPO_ROOT/dashboard/lib/sdk"
)

# Copy IDL from anchor build output if it exists
IDL_OUTPUT="$REPO_ROOT/program/target/idl/guardrails.json"
if [ -f "$IDL_OUTPUT" ]; then
  cp "$IDL_OUTPUT" "$SDK_SRC/idl/guardrails.json"
  echo "Updated sdk/idl/guardrails.json from anchor build output"
fi

# Sync sdk/ to each consumer
for target in "${TARGETS[@]}"; do
  rm -rf "$target"
  cp -r "$SDK_SRC" "$target"
  echo "Synced → $target"
done

echo "SDK sync complete."
