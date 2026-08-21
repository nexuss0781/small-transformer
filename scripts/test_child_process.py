"""Minimal standard-library fixture used only by the Node integration tests."""

import json
import sys


def main() -> None:
    payload = json.load(sys.stdin)
    if payload.get("mode") == "fail":
        print("intentional fixture failure", file=sys.stderr, flush=True)
        raise SystemExit(7)
    print(json.dumps({"ok": True, "echo": payload.get("value")}), flush=True)


if __name__ == "__main__":
    main()
