// index.ts
import { router } from "./src/routing/router";

console.clear();
const server = Bun.serve({
  port: 3000,
  // 1. Ta bort `routes`-objektet helt för att undvika konflikter!
  async fetch(req) {
    const url = new URL(req.url);
    const startTime = performance.now();

    // 2. Servera filer från mappen ./public direkt på roten (/)
    // Exempel: /styles/output.css letar efter ./public/styles/output.css
    const publicFilePath = `./public${url.pathname}`;
    const publicFile = Bun.file(publicFilePath);
    
    if (await publicFile.exists()) {
      logRequest(req.method, url.pathname, 200, startTime); // Valfritt: logga statiska filer
      return new Response(publicFile);
    }

    // 3. Din befintliga hantering för HTMX
    if (url.pathname === "/htmx.js") {
      const htmxPath = Bun.file("./node_modules/htmx.org/dist/htmx.min.js");
      logRequest(req.method, url.pathname, 200, startTime);
      return new Response(htmxPath, {
        headers: { "Content-Type": "application/javascript" }
      });
    }

    // 4. Din dynamiska router och loggning
    try {
      const routeResult = await router(req);

      if (routeResult) {
        const { response, includedFiles } = routeResult;
        logRequest(req.method, url.pathname, response.status, startTime, includedFiles);
        return response;
      }

      // 404 Fallback
      const notFoundRes = new Response("<h3>404 Not Found</h3>", { status: 404, headers: { "Content-Type": "text/html" } });
      logRequest(req.method, url.pathname, 404, startTime);
      return notFoundRes;

    } catch (error: any) {
      const errorRes = new Response("<h3>500 Error</h3>", { status: 500, headers: { "Content-Type": "text/html" } });
      logRequest(req.method, url.pathname, 500, startTime);
      console.error(`\x1b[31m[ERROR]\x1b[0m`, error);
      return errorRes;
    }
  }
});

function logRequest(
  method: string, 
  path: string, 
  status: number, 
  startTime: number, 
  includedFiles: string[] = []
) {
  const duration = (performance.now() - startTime).toFixed(2);
  const time = new Date().toLocaleTimeString();
  
  let statusColor = "\x1b[32m"; 
  if (status >= 400 && status < 500) statusColor = "\x1b[33m"; 
  if (status >= 500) statusColor = "\x1b[31m"; 

  const reset = "\x1b[0m";
  const gray = "\x1b[90m";
  const bold = "\x1b[1m";

  // 1. Log the main request metrics line
  console.log(
    `[${gray}${time}${reset}] ${bold}${method}${reset} ${path} -> ${statusColor}${status}${reset} ${gray}(${duration}ms)${reset}`
  );

  // 2. Log the specific files used under it
  if (includedFiles.length > 0) {
    const fileChain = includedFiles.map(f => `\x1b[36m${f}\x1b[0m`).join(`${gray} → ${reset}`);
    console.log(`   ${gray}└─ Templates:${reset} ${fileChain}`);
  }
}


console.log(`[WATCH ACTIVE] http://localhost:${server.port}`);
