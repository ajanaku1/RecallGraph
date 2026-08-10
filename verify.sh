#!/usr/bin/env bash
# RecallGraph predicates derive from Goal.md. Done means this exits 0; fresh scaffolds stay red.
set -uo pipefail
cd "$(dirname "$0")"
FILTER="${1:-}"; pass=0; fail=0; executed=0
check() {
  local tag="$1" desc="$2"; shift 2
  [ -z "$FILTER" ] || [ "$tag" = "$FILTER" ] || return 0
  executed=$((executed + 1))
  if "$@" >/dev/null 2>&1; then printf '  PASS  [%s] %s\n' "$tag" "$desc"; pass=$((pass + 1)); else printf '  FAIL  [%s] %s\n' "$tag" "$desc"; fail=$((fail + 1)); fi
}
checksh() { check "$1" "$2" sh -c "$3"; }
script() { test -f package.json && npm run --silent "$1"; }
echo '== RecallGraph verify =='
check phase-0 'live-gate evidence and behavior' sh -c 'test -f .evidence/live-gate.json && test -f package.json && npm run --silent verify:live-gate'
check phase-1 'pure-core tests' script test:core
check phase-1 'fixture contract' script verify:fixture
check phase-2 'brand gate: words, three marks, one winner' script verify:brand-gate
check phase-2 'UI gate: three directions, one winner' script verify:ui-gate
checksh phase-2 'unselected prototypes removed after promotion' 'test -f prototypes/SELECTED.md && test -d prototypes/selected && test "$(find prototypes -mindepth 1 -maxdepth 1 ! -name SELECTED.md ! -name selected -print -quit)" = ""'
check phase-3 'adapter tests' script test:adapters
check phase-3 'DataHub contract' script verify:datahub-contract
check phase-4 'fixture E2E' script test:e2e:fixture
check phase-4 'accessibility journey' script verify:a11y
check phase-5 'lint' script lint
check phase-5 'typecheck' script typecheck
check phase-5 'tests and build' sh -c 'test -f package.json && npm run --silent test && npm run --silent build'
checksh phase-5 'guarded source hygiene' 'test -d src && ! rg -n "TO""DO|FIX""ME|\\bany\\b" src'
checksh phase-5 'function guideline' 'test -f scripts/check-function-length.sh && sh scripts/check-function-length.sh'
check phase-6 'submission evidence' script verify:submission
echo
if [ "$executed" -eq 0 ]; then printf '  FAIL  [filter] no checks matched "%s"; executed 0 predicates\n' "$FILTER"; fail=$((fail + 1)); fi
printf 'passed %d, failed %d\n' "$pass" "$fail"
cat <<'MANUAL'
manual:
  [ ] visual quality and responsive accessibility
  [ ] three-minute pacing and truthful live-mode footage
  [ ] GitHub About license, public visibility, final Devpost copy and survey
MANUAL
[ "$fail" -eq 0 ] || exit 1
