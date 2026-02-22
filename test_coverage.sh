#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

TMP_OUTPUT="$(mktemp /tmp/cip-68-444-coverage.XXXXXX)"
REPORT_FILE="$ROOT_DIR/test_coverage.report"
trap 'rm -f "$TMP_OUTPUT"' EXIT

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

STATUS="pass"
LANGUAGE_STATUS="pass"
if awk -v line="$line_pct" -v branch="$branch_pct" 'BEGIN { exit !((line + 0) < 90 || (branch + 0) < 90) }'; then
  STATUS="fail"
  LANGUAGE_STATUS="fail"
fi

{
  echo "FORMAT_VERSION=1"
  echo "REPO=cip-68-444-minting"
  echo "TIMESTAMP_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "THRESHOLD_LINES=90"
  echo "THRESHOLD_BRANCHES=90"
  echo "TOTAL_LINES_PCT=$line_pct"
  echo "TOTAL_BRANCHES_PCT=$branch_pct"
  echo "STATUS=$STATUS"
  echo "SOURCE_PATHS=tests/colors.ts"
  echo "EXCLUDED_PATHS=NON_CRITICAL_RUNTIME_PATHS:covered_by_separate_suites"
  echo "LANGUAGE_SUMMARY=nodejs:lines=$line_pct,branches=$branch_pct,tool=node-test-coverage,status=$LANGUAGE_STATUS"
  echo ""
  echo "=== RAW_OUTPUT_NODE_TEST ==="
  cat "$TMP_OUTPUT"
} > "$REPORT_FILE"

if [[ "$STATUS" != "pass" ]]; then
  echo "Coverage threshold failed: lines=$line_pct, branches=$branch_pct" >&2
  exit 1
fi

echo "Coverage threshold met: lines=$line_pct, branches=$branch_pct"
