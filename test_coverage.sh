#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

REPORT_FILE="$ROOT_DIR/test_coverage.report"
TMP_DIR="$(mktemp -d /tmp/cip-68-444-coverage.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

TEST_OUT="$TMP_DIR/npm-test.out"
C8_OUT="$TMP_DIR/c8.out"

# Standard test entrypoint.
npm test | tee "$TEST_OUT"

# Measurable TypeScript harness scope.
npx c8 \
  --all \
  --include='tests/**/*.ts' \
  --exclude='**/node_modules/**' \
  --exclude='**/*.test.ts' \
  --reporter=text \
  --reporter=text-summary \
  npm test | tee "$C8_OUT"

line_pct="$(
  awk -F':' '/^Lines/{value=$2; gsub(/^ +/, "", value); sub(/%.*$/, "", value); print value; exit}' "$C8_OUT"
)"
branch_pct="$(
  awk -F':' '/^Branches/{value=$2; gsub(/^ +/, "", value); sub(/%.*$/, "", value); print value; exit}' "$C8_OUT"
)"

if [[ -z "$line_pct" || -z "$branch_pct" ]]; then
  echo "Unable to parse c8 summary metrics" >&2
  exit 1
fi

MEASURED_STATUS="pass"
if awk -v line="$line_pct" -v branch="$branch_pct" 'BEGIN { exit !((line + 0) < 90 || (branch + 0) < 90) }'; then
  MEASURED_STATUS="fail"
fi

STATUS="partial"
if [[ "$MEASURED_STATUS" == "fail" ]]; then
  STATUS="fail"
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
  echo "SOURCE_PATHS=minting.helios,editing.helios,tests/**/*.ts"
  echo "EXCLUDED_PATHS=minting.helios:helios_source_not_supported_by_v8_coverage;editing.helios:helios_source_not_supported_by_v8_coverage"
  echo "LANGUAGE_SUMMARY=typescript-tests:lines=$line_pct,branches=$branch_pct,tool=c8,status=$MEASURED_STATUS;helios:lines=NA,branches=NA,tool=helios-runtime-tests,status=na"
  echo ""
  echo "=== RAW_OUTPUT_NPM_TEST ==="
  cat "$TEST_OUT"
  echo ""
  echo "=== RAW_OUTPUT_C8 ==="
  cat "$C8_OUT"
} > "$REPORT_FILE"

if [[ "$MEASURED_STATUS" != "pass" ]]; then
  echo "Coverage threshold failed for measured scope: lines=$line_pct, branches=$branch_pct" >&2
  exit 1
fi

echo "Measured coverage threshold met: lines=$line_pct, branches=$branch_pct"
