"""Serves src/ so you can work on the UI in a normal browser, with js/mock.js faking the Rust side.

Caching is off so a reload always picks up your changes. Run: python tools/devserver.py [port]
"""

import functools
import http.server
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src"


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    handler = functools.partial(NoCache, directory=str(SRC))
    http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
