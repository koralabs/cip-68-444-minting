#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

TMP_OUTPUT="$(mktemp /tmp/cip-68-444-coverage.XXXXXX)"

node --experimental-strip-types --test \
  --experimental-test-coverage \
  --test-coverage-include='tests/colors.ts' \
  tests/coverage.targets.test.ts | tee "$TMP_OUTPUT"

coverage_line="$(grep -E '^# all files' "$TMP_OUTPUT" | tail -1)"
if [ -z "$coverage_line" ]; then
  echo "Unable to parse coverage summary from test output" >&2
  exit 1
fi

line_pct="$(echo "$coverage_line" | awk -F'|' '{gsub(/ /, "", $2); print $2}')"
branch_pct="$(echo "$coverage_line" | awk -F'|' '{gsub(/ /, "", $3); print $3}')"

awk -v line="$line_pct" -v branch="$branch_pct" 'BEGIN { if ((line + 0) < 90 || (branch + 0) < 90) exit 1 }'

{
  echo "line_pct=$line_pct"
  echo "branch_pct=$branch_pct"
  echo ""
  cat "$TMP_OUTPUT"
} > test_coverage.report

echo "Coverage threshold met: lines=$line_pct, branches=$branch_pct"
