# Local dev server: serves this folder, plus /img?url=... which fetches a
# generated painting and passes it to the page, so Three.js can use it (CORS).
# Run: python3 server.py   then open http://localhost:8001
import http.server
import os
import urllib.parse
import urllib.request

PORT = 8001
# Only fetch from Replicate's image hosts, so this isn't an open proxy
ALLOWED_HOSTS = ('.r2.cloudflarestorage.com', 'replicate.delivery')


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != '/img':
            return super().do_GET()

        url = urllib.parse.parse_qs(parsed.query).get('url', [''])[0]
        host = urllib.parse.urlparse(url).hostname or ''
        if not url.startswith('https://') or not host.endswith(ALLOWED_HOSTS):
            return self.send_error(400, 'Image host not allowed')

        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                data = r.read()
                content_type = r.headers.get('Content-Type', 'image/jpeg')
        except Exception as err:
            return self.send_error(502, f'Could not fetch image: {err}')

        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f'Dream Gallery on http://localhost:{PORT}')
http.server.ThreadingHTTPServer(('', PORT), Handler).serve_forever()
