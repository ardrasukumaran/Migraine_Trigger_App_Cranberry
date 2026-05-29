import path from "node:path";

const clientDir = path.resolve(process.cwd(), "dist/client");
const port = parseInt(process.env.PORT ?? "3000", 10);

const MIME: Record<string, string> = {
  ".html":        "text/html; charset=utf-8",
  ".css":         "text/css; charset=utf-8",
  ".js":          "application/javascript; charset=utf-8",
  ".mjs":         "application/javascript; charset=utf-8",
  ".json":        "application/json",
  ".webmanifest": "application/manifest+json",
  ".png":         "image/png",
  ".jpg":         "image/jpeg",
  ".jpeg":        "image/jpeg",
  ".svg":         "image/svg+xml",
  ".ico":         "image/x-icon",
  ".woff":        "font/woff",
  ".woff2":       "font/woff2",
  ".ttf":         "font/ttf",
};

Bun.serve({
  port,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    const filePath = path.join(clientDir, url.pathname);

    if (!path.resolve(filePath).startsWith(clientDir)) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = Bun.file(filePath);
    if (await file.exists()) {
      const ext = path.extname(filePath).toLowerCase();
      return new Response(file, {
        headers: { "content-type": MIME[ext] ?? "application/octet-stream" },
      });
    }

    // SPA fallback — let the client router handle the path
    return new Response(Bun.file(path.join(clientDir, "index.html")), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
});

console.log(`Server listening on port ${port}`);
