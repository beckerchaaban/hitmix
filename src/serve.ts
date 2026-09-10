import { router } from "./routing/router";

export interface ServeOptions {
  port?: number;
  appPath?:string;
}

export function serve(options: ServeOptions = {}) {
  const port = options.port ?? 3000;

  console.clear();
  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      const startTime = performance.now();

      const publicFilePath = `./public${url.pathname}`;
      const publicFile = Bun.file(publicFilePath);

      if (await publicFile.exists()) {
        logRequest(req.method, url.pathname, 200, startTime);
        return new Response(publicFile);
      }

      if (url.pathname === "/htmx.js") {
        logRequest(req.method, url.pathname, 200, startTime);
        return new Response(Bun.file("./node_modules/htmx.org/dist/htmx.min.js"), {
          headers: { "Content-Type": "application/javascript" },
        });
      }

      try {
        const routeResult = await router(req);

        if (routeResult) {
          const { response, includedFiles } = routeResult;
          logRequest(req.method, url.pathname, response.status, startTime, includedFiles);
          return response;
        }

        logRequest(req.method, url.pathname, 404, startTime);
        return new Response("<h3>404 Not Found</h3>", { status: 404, headers: { "Content-Type": "text/html" } });
      } catch (error) {
        logRequest(req.method, url.pathname, 500, startTime);
        console.error(`\x1b[31m[ERROR]\x1b[0m`, error);
        return new Response("<h3>500 Error</h3>", { status: 500, headers: { "Content-Type": "text/html" } });
      }
    },
  });

  console.log(`[WATCH ACTIVE] http://localhost:${server.port}`);
  return server;
}

function logRequest(method: string, path: string, status: number, startTime: number, includedFiles: string[] = []) {
  const duration = (performance.now() - startTime).toFixed(2);
  const time = new Date().toLocaleTimeString();

  let statusColor = "\x1b[32m";
  if (status >= 400 && status < 500) statusColor = "\x1b[33m";
  if (status >= 500) statusColor = "\x1b[31m";

  const reset = "\x1b[0m";
  const gray = "\x1b[90m";
  const bold = "\x1b[1m";

  console.log(
    `[${gray}${time}${reset}] ${bold}${method}${reset} ${path} -> ${statusColor}${status}${reset} ${gray}(${duration}ms)${reset}`,
  );

  if (includedFiles.length > 0) {
    const fileChain = includedFiles.map((f) => `\x1b[36m${f}\x1b[0m`).join(`${gray} → ${reset}`);
    console.log(`   ${gray}└─ Templates:${reset} ${fileChain}`);
  }
}
