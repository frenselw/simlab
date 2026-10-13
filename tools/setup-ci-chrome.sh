#!/usr/bin/env bash
set -euo pipefail

[[ "${GITHUB_ACTIONS:-}" == true && "${OSTYPE:-}" == linux* ]]
ci_chrome="$(realpath -e "$CHROME_PATH")"
[[ -x "$ci_chrome" && "$ci_chrome" =~ ^/(opt|home/runner|tmp)/[a-zA-Z0-9_./-]+$ ]]

# Ubuntu's packaged Chrome profile does not cover the pinned Chrome for Testing path.
printf 'abi <abi/4.0>,\ninclude <tunables/global>\nprofile simlab-ci-chrome "%s" flags=(unconfined) {\n  userns,\n}\n' "$ci_chrome" |
  sudo tee /etc/apparmor.d/simlab-ci-chrome >/dev/null
sudo apparmor_parser -r /etc/apparmor.d/simlab-ci-chrome

mkdir -p output/ci-tests
timeout 15s "$ci_chrome" --headless=new --no-first-run --dump-dom about:blank +  >output/ci-tests/chrome-startup.html 2>output/ci-tests/chrome-startup.log
