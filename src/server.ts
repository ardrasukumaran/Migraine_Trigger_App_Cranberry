import path from "node:path";

const clientDir = path.resolve(import.meta.dir, "..", "client");
const port = parseInt(process.env.PORT ?? "3000", 10);

Bun.serve({
  port,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    const filePath = path.join(clientDir, url.pathname);

    // Guard against directory traversal
    if (!path.resolve(filePath).startsWith(clientDir)) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }

    // SPA fallback — let the client router handle the path
    return new Response(Bun.file(path.join(clientDir, "index.html")), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
});

console.log(`Server listening on port ${port}`);
