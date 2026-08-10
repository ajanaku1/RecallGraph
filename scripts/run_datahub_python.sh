#!/usr/bin/env sh
set -eu

if [ -n "${DATAHUB_PYTHON:-}" ]; then
  exec "$DATAHUB_PYTHON" "$@"
fi

for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import datahub' >/dev/null 2>&1; then
    exec "$candidate" "$@"
  fi
done

printf '%s\n' 'DataHub Python SDK missing. Set DATAHUB_PYTHON to an interpreter with acryl-datahub.' >&2
exit 127
