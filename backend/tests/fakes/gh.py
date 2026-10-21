"""Un `gh` falso en el PATH para los tests del adaptador real `GhPrSource`."""

from __future__ import annotations

import json
import stat
from pathlib import Path


def fake_gh(
    bin_dir: Path,
    listing: object = (),
    *,
    exit_code: int = 0,
    stderr: str = "",
    raw_listing: str | None = None,
    sleep: float = 0,
) -> Path:
    """Un `gh` falso en el PATH: `pr list` imprime `listing`, `pr diff N` imprime un diff."""
    bin_dir.mkdir(exist_ok=True)
    listing_text = raw_listing if raw_listing is not None else json.dumps(listing)
    script = bin_dir / "gh"
    script.write_text(
        "#!/bin/sh\n"
        f"sleep {sleep}\n"
        f"echo {json.dumps(stderr)} >&2\n"
        f"[ {exit_code} -ne 0 ] && exit {exit_code}\n"
        'echo "$@" >> "$(dirname "$0")/calls"\n'
        'if [ "$2" = "list" ]; then\n'
        f"  cat <<'JSON'\n{listing_text}\nJSON\n"
        "else\n"
        '  echo "diff de la PR $3"\n'
        "fi\n"
    )
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    return script
