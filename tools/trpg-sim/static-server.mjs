import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");
const port = Number(process.env.PORT ?? process.argv[2] ?? 8765);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const requested = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const destination = path.resolve(root, `.${requested}`);
  if (!destination.startsWith(`${root}${path.sep}`) || !fs.existsSync(destination) || !fs.statSync(destination).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "content-type": types[path.extname(destination)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  fs.createReadStream(destination).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`TRPG simulation preview: http://127.0.0.1:${port}/TRPG/simulation.html`);
});
