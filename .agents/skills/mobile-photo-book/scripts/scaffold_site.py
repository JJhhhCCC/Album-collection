#!/usr/bin/env python3
"""Copy the mobile photo-book static template into an empty directory."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path, help="empty directory to receive the site")
    args = parser.parse_args()

    source = Path(__file__).resolve().parents[1] / "assets" / "site-template"
    target = args.target.resolve()
    if not source.is_dir():
        print(f"Template is missing: {source}", file=sys.stderr)
        return 1
    if target.exists() and any(target.iterdir()):
        print(f"Refusing to overwrite non-empty directory: {target}", file=sys.stderr)
        return 2

    target.mkdir(parents=True, exist_ok=True)
    for entry in source.iterdir():
        destination = target / entry.name
        if entry.is_dir():
            shutil.copytree(entry, destination)
        else:
            shutil.copy2(entry, destination)
    print(f"Created mobile photo-book site at {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
