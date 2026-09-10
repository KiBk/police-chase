"""Local preview that always refreshes the latest built game files."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    public = Path(__file__).resolve().parents[1] / "public"
    handler = partial(PreviewHandler, directory=str(public))
    with ThreadingHTTPServer(("127.0.0.1", 8098), handler) as server:
        print("Police Chase preview: http://127.0.0.1:8098/", flush=True)
        server.serve_forever()
