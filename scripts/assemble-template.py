#!/usr/bin/env python3
"""Turn a checkout of the Shiloh app into the generic Church OS template.

Reads template-pack/MANIFEST.json (produced with the template pack) and, in a
TARGET directory (never in place — you always assemble into a copy):

  1. copies every "replace" entry over the Shiloh-specific file,
  2. deletes every "delete" entry (Shiloh's photos, Shiloh-only assets),
  3. drops the template-pack/ staging directory itself from the result.

Usage:
    python3 scripts/assemble-template.py /path/to/target-copy

Typical flow:
    git clone <this repo> /tmp/template && python3 scripts/assemble-template.py /tmp/template
    # /tmp/template is now Grace Community Church — the generic template —
    # ready to push to the Church-OS-Template repository.

The script refuses to run against the current directory's own working tree
unless it is explicitly a different path, and prints every action it takes.
"""
import json
import os
import shutil
import sys


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    target = os.path.abspath(sys.argv[1])
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if target == here:
        print("Refusing to assemble in place. Clone or copy the repo first, "
              "then point this script at the copy.")
        sys.exit(1)
    manifest_path = os.path.join(target, "template-pack", "MANIFEST.json")
    if not os.path.exists(manifest_path):
        print("No template-pack/MANIFEST.json in the target — is this a full checkout?")
        sys.exit(1)

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    replaced, deleted, missing = 0, 0, []

    for entry in manifest.get("replace", []):
        src = os.path.join(target, entry["from"])
        dst = os.path.join(target, entry["to"])
        if not os.path.exists(src):
            missing.append(entry["from"])
            continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        print("replace:", entry["to"])
        replaced += 1

    for rel in manifest.get("delete", []):
        path = os.path.join(target, rel)
        if os.path.isdir(path):
            shutil.rmtree(path)
            print("delete dir:", rel)
            deleted += 1
        elif os.path.exists(path):
            os.remove(path)
            print("delete:", rel)
            deleted += 1

    shutil.rmtree(os.path.join(target, "template-pack"))
    print("delete dir: template-pack/ (staging)")

    # Validate every data file in the assembled result parses.
    bad = []
    data_dir = os.path.join(target, "data")
    for name in sorted(os.listdir(data_dir)):
        if name.endswith(".json"):
            try:
                json.load(open(os.path.join(data_dir, name), encoding="utf-8"))
            except Exception as e:
                bad.append(name + ": " + str(e))

    print(f"\nassembled: {replaced} replaced, {deleted} deleted")
    if missing:
        print("MISSING sources (manifest expected these):")
        for m in missing:
            print("  -", m)
    if bad:
        print("INVALID JSON after assembly:")
        for b in bad:
            print("  -", b)
    if missing or bad:
        sys.exit(1)
    print("All data files valid. This directory is now the generic template.")


if __name__ == "__main__":
    main()
