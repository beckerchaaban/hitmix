/// <reference path="../types/urlpattern.d.ts" />
import { join, basename } from "path";
import { composeHtmlLayout } from "../templating/layout-template";
export interface RouterResult {
  response: Response;
  includedFiles: string[];
}

export async function router(req: Request): Promise<RouterResult | null> {
  const url = new URL(req.url);
  let pathname = url.pathname;

  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  const includedFiles: string[] = ["index.htmx"];

  let templateFilePath = "";
  let scriptFilePath = "";
  let layoutFilePath = "";
  let data: any = null;
  let params: Record<string, string | undefined> = {};
  
  const isRoot = pathname === "/" || pathname === "";

  if (isRoot) {
    const targetDir = join(process.cwd(), "app", "pages", "home");
    templateFilePath = join(targetDir, "home.htmx");
    scriptFilePath = join(targetDir, "home.tsx");

    const localLayoutPath = join(targetDir, "layout.htmx");
    const rootLayoutPath = join(process.cwd(), "app", "pages", "layout.htmx");
    if (await Bun.file(localLayoutPath).exists()) {
      layoutFilePath = localLayoutPath;
      includedFiles.push("home:layout.htmx");
    } else if (await Bun.file(rootLayoutPath).exists()) {
      layoutFilePath = rootLayoutPath;
    }

    includedFiles.push("home.htmx");
  } else {
    const rootSegments = pathname.split("/").filter(Boolean);
    const primaryFolder = rootSegments[0] || "";
    
    const targetDir = join(process.cwd(), "app", "pages", primaryFolder);
    scriptFilePath = join(targetDir, `${primaryFolder}.tsx`);
    templateFilePath = join(targetDir, `${primaryFolder}.htmx`);

    if (!await Bun.file(scriptFilePath).exists()) {
      const folderName = basename(pathname);
      const fallbackDir = join(process.cwd(), "app", "pages", pathname);
      templateFilePath = join(fallbackDir, `${folderName}.htmx`);
      scriptFilePath = join(fallbackDir, `${folderName}.tsx`);
    }

    const localLayoutPath = join(process.cwd(), "app", "pages", primaryFolder, "layout.htmx");
    const rootLayoutPath = join(process.cwd(), "app", "pages", "layout.htmx");
    if (await Bun.file(localLayoutPath).exists()) {
      layoutFilePath = localLayoutPath;
      includedFiles.push("layout.htmx");
    } else if (await Bun.file(rootLayoutPath).exists()) {
      layoutFilePath = rootLayoutPath;
    }

    if (await Bun.file(templateFilePath).exists()) {
      includedFiles.push(`${basename(templateFilePath)}`);
    }
  }

  const templateFile = Bun.file(templateFilePath);
  if (!(await templateFile.exists())) {
    return null;
  }

  let pageContent = await templateFile.text();

  const scriptFile = Bun.file(scriptFilePath);
  let activeScriptPath = scriptFilePath;
  if (!(await scriptFile.exists())) {
    activeScriptPath = scriptFilePath.replace(/\.tsx$/, ".js");
  }

  if (await Bun.file(activeScriptPath).exists()) {
    try {
      const dataModule = await import(activeScriptPath);
      const endpoints = dataModule.default;
      let handler: Function | null = null;
      const rootSegments = pathname.split("/").filter(Boolean);
      const primaryFolder = rootSegments[0] || "";

      if (Array.isArray(endpoints)) {
        for (const endpoint of endpoints) {
          if (endpoint.method === req.method) {
            if (endpoint.route) {
              const pattern = new URLPattern({ pathname: endpoint.route });
              const match = pattern.exec(url);
              if (match) {
                params = match.pathname.groups;
                handler = endpoint;
                break;
              }
            } else if (pathname === `/${primaryFolder}` || (isRoot && primaryFolder === "")) {
              handler = endpoint;
              break;
            }
          }
        }
      } else {
        handler = dataModule[req.method] || dataModule.default;
      }

      if (typeof handler === "function") {
        const query = Object.fromEntries(url.searchParams.entries());
        let body = {};

        if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
          const contentType = req.headers.get("content-type") || "";
          if (contentType.includes("application/x-www-form-urlencoded")) {
            const rawText = await req.text();
            const params = new URLSearchParams(rawText);
            body = Object.fromEntries(params.entries());
          }
        }

        let statusCode = 200;
        const customHeaders: Record<string, string> = {};
        
        const res = {
          trigger(events: Record<string, any>) {
            const json = JSON.stringify(events);
            customHeaders["HX-Trigger"] = Buffer.from(json, "utf-8").toString("binary");
          },
          triggerAfterReceive(events: Record<string, any>) {
            const json = JSON.stringify(events);
            customHeaders["HX-Trigger-After-Receive"] = Buffer.from(json, "utf-8").toString("binary");
          },
          triggerAfterSwap(events: Record<string, any>) {
            const json = JSON.stringify(events);
            customHeaders["HX-Trigger-After-Swap"] = Buffer.from(json, "utf-8").toString("binary");
          },
          header(key: string, value: string) {
            customHeaders[key] = Buffer.from(value, "utf-8").toString("binary");
          },
          status(code: number) {
            statusCode = code;
            return this;
          },
          redirect(url: string) {
            customHeaders["HX-Redirect"] = url;
          },
          location(url: string) {
            customHeaders["HX-Location"] = url;
          },
          pushUrl(url: string) {
            customHeaders["HX-Push-Url"] = url;
          },
          reswap(option: string) {
            customHeaders["HX-Reswap"] = option;
          }
        };

        data = await handler({ req, params, query, body, res });
        if (data instanceof Response) {
          return { response: data, includedFiles };
        }

        const responseHeaders = new Headers({ "Content-Type": "text/html" });
        for (const [key, val] of Object.entries(customHeaders)) {
          responseHeaders.set(key, val);
        }
            if ((data === "" || !data) && req.method === "DELETE") {
          return {
            response: new Response("", { status: statusCode, headers: responseHeaders }),
            includedFiles,
          };
        }
        if (data && typeof data === "string") {
          return {
            response: new Response(data, { status: statusCode, headers: responseHeaders }),
            includedFiles,
          };
        }
        if (!data && req.method === "DELETE") {
          return {
            response: new Response("", { status: statusCode, headers: responseHeaders }),
            includedFiles,
          };
        }
        if (data && typeof data === "object") {
          for (const [key, value] of Object.entries(data)) {
            let stringValue = "";

            if (typeof value === "object" && value !== null) {
              stringValue = JSON.stringify(value);
            } else {
              stringValue = String(value);
            }

            // Byter ut {{workspaceName}}, {{timestamp}} etc. i din HTML-mall!
            pageContent = pageContent.replaceAll(`{{${key}}}`, stringValue);
          }
        }

      }
    } catch (err) {
      console.error(`Error running script logic for route ${pathname}:`, err);
    }
  }

  const finalHtml = await composeHtmlLayout({
    pageContent,
    layoutFilePath,
    isRoot,
    dataContext: data || {},
  });

  return {
    response: new Response(finalHtml, { headers: { "Content-Type": "text/html" } }),
    includedFiles,
  };
}
