#!/usr/bin/env bash
set -euo pipefail
export PATH="/usr/bin:/bin:$PATH"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PWCLI="${PWCLI:-/c/Users/frens/.codex/skills/playwright/scripts/playwright_cli.sh}"
SESSION="🔬 Orthogonal $$"
LIFECYCLE_SESSION="🔬 Orthogonal lifecycle $$"
PACKAGE_ROOT="$ROOT/output/force-orthogonal-decomposition-scorm-extracted"
SERVER_ID="force-orthogonal-${RANDOM}-${RANDOM}"
server_pid=""
server_log=""
session_started="false"
lifecycle_session_started="false"
PORT=""

cleanup() {
  set +e
  if [[ "${session_started}" == "true" ]]; then
    "$PWCLI" --session "$SESSION" close >/dev/null 2>&1 || true
  fi
  if [[ "${lifecycle_session_started}" == "true" ]]; then
    "$PWCLI" --session "$LIFECYCLE_SESSION" close >/dev/null 2>&1 || true
  fi
  if [[ -n "${server_pid}" ]]; then
    kill "${server_pid}" >/dev/null 2>&1 || true
    wait "${server_pid}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${server_log}" ]]; then rm -f "$server_log"; fi
}
trap cleanup EXIT INT TERM

if ! (cd "$ROOT" && node tools/package-scorm.js force-orthogonal-decomposition >/dev/null && node tools/force-orthogonal-decomposition-extract.js >/dev/null); then
  echo "### Error: failed to build or extract the force orthogonal SCORM package" >&2
  exit 1
fi

server_log="$(mktemp)"
(
  cd "$ROOT"
  SIMLAB_PORT=0 SIMLAB_SERVER_ID="$SERVER_ID" SIMLAB_PACKAGE_ROOT="$PACKAGE_ROOT" node tools/force-orthogonal-decomposition-static-server.js
) >"$server_log" 2>&1 &
server_pid=$!

ready="false"
for attempt in $(seq 1 100); do
  if [[ -z "$PORT" && -f "$server_log" ]]; then
    PORT="$(sed -n 's/.*SIMLAB_SERVER_PORT=\([0-9][0-9]*\).*/\1/p' "$server_log" | tail -n 1)"
  fi
  if [[ -n "$PORT" ]]; then
    health="$(curl --silent --fail "http://127.0.0.1:${PORT}/__simlab_health" 2>/dev/null || true)"
    source_status="$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:${PORT}/sim/force-orthogonal-decomposition/index.html" 2>/dev/null || true)"
    packaged_status="$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:${PORT}/packaged/force-orthogonal-decomposition/index.html" 2>/dev/null || true)"
    if [[ "$health" == *"\"serverId\":\"$SERVER_ID\""* && "$health" == *"force-orthogonal-decomposition/index.html"* && "$source_status" == "200" && "$packaged_status" == "200" ]]; then
      ready="true"
      break
    fi
  fi
  if ! kill -0 "$server_pid" >/dev/null 2>&1; then
    cat "$server_log"
    echo "### Error: owned local static server exited before identity and route checks passed" >&2
    exit 1
  fi
  sleep 0.1
done
if [[ "$ready" != "true" ]]; then
  cat "$server_log"
  echo "### Error: owned local static server did not pass identity/source/packaged readiness" >&2
  exit 1
fi

if [[ "${FOD_LIFECYCLE_ONLY:-0}" != "1" ]]; then
  session_started="true"
  set +e
  open_output=$("$PWCLI" --session "$SESSION" open "http://127.0.0.1:${PORT}/sim/force-orthogonal-decomposition/index.html?playwright=bootstrap" 2>&1)
  open_status=$?
  set -e
  printf '%s\n' "$open_output"
  if [[ "$open_status" -ne 0 || "$open_output" == *"### Error"* ]]; then
    echo "### Error: Playwright browser open failed" >&2
    exit 1
  fi

  set +e
  run_output=$(cd "$ROOT" && "$PWCLI" --session "$SESSION" run-code --filename tools/force-orthogonal-decomposition-playwright-check.js 2>&1)
  run_status=$?
  set -e
  printf '%s\n' "$run_output"
  if [[ "$run_status" -ne 0 || "$run_output" == *"### Error"* ]]; then
    echo "### Error: force orthogonal Playwright regression failed" >&2
    exit 1
  fi
fi

set +e
lifecycle_session_started="true"
lifecycle_open_output=$("$PWCLI" --session "$LIFECYCLE_SESSION" open "http://127.0.0.1:${PORT}${FOD_LIFECYCLE_PATH:-/sim/force-orthogonal-decomposition/index.html}?playwright=lifecycle-bootstrap" 2>&1)
lifecycle_open_status=$?
set -e
printf '%s\n' "$lifecycle_open_output"
if [[ "$lifecycle_open_status" -ne 0 || "$lifecycle_open_output" == *"### Error"* ]]; then
  echo "### Error: Playwright lifecycle browser open failed" >&2
  exit 1
fi

set +e
lifecycle_output=$(cd "$ROOT" && "$PWCLI" --session "$LIFECYCLE_SESSION" run-code --filename tools/force-orthogonal-decomposition-lifecycle-playwright-check.js 2>&1)
lifecycle_status=$?
set -e
printf '%s\n' "$lifecycle_output"
if [[ "$lifecycle_status" -ne 0 || "$lifecycle_output" == *"### Error"* ]]; then
  echo "### Error: force orthogonal production lifecycle regression failed" >&2
  exit 1
fi
