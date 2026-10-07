#!/bin/sh
# @doctiling/ui (design system) is a peer dependency that lives in the private
# doctiling-web repo as a raw-TS workspace package. The consumer resolves it
# from its own workspace; this repo's typecheck and tests resolve it through
# the `.ui` symlink, pointed at a doctiling-web checkout:
#   DOCTILING_UI_DIR=/path/to/doctiling-web/packages/ui   (CI: sparse checkout)
#   default: ../web/packages/ui                            (doctiling/ workspace layout)
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
UI=${DOCTILING_UI_DIR:-"$ROOT/../web/packages/ui"}
[ -f "$UI/package.json" ] || {
  echo "link-ui: no @doctiling/ui at $UI — clone doctiling-web next to this repo or set DOCTILING_UI_DIR" >&2
  exit 1
}
rm -f "$ROOT/.ui"
ln -s "$(cd "$UI" && pwd)" "$ROOT/.ui"
echo "link-ui: .ui -> $(readlink "$ROOT/.ui")"
