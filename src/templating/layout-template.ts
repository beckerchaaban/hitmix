import { join } from "path";
import { parseHTML } from "linkedom";
import Handlebars from "handlebars";

interface TemplateOptions {
  pageContent: string;
  layoutFilePath: string;
  rootLayoutFilePath?: string;
  appPath: string;
  isRoot: boolean;
  dataContext?: Record<string, any>;
}

Handlebars.registerHelper("json", function (context) {
  return JSON.stringify(context);
});

Handlebars.registerHelper("eq", function (a, b) {
  return a === b;
});

Handlebars.registerHelper("startsWith", function (str, prefix) {
  return typeof str === "string" && str.startsWith(prefix);
});

// `hx-content`/`hx-root` aren't real HTML void elements, so an HTML parser
// won't actually self-close a `<hx-content />` tag — it keeps consuming
// following siblings as its children instead. Rewrite it to an explicit
// pair before parsing so anything after it in the layout survives.
function closeSelfClosingTag(html: string, tagName: string): string {
  const selfClosingRegex = new RegExp(`<${tagName}([^>]*)\\/>`, "gi");
  return html.replace(selfClosingRegex, `<${tagName}$1></${tagName}>`);
}

async function applyLayout(
  content: string,
  layoutFilePath: string,
  appPath: string,
): Promise<string> {
  const layoutFile = Bun.file(layoutFilePath);
  if (!(await layoutFile.exists())) {
    return content;
  }

  const layoutTemplateSrc = closeSelfClosingTag(
    await processImportElements(await layoutFile.text(), appPath),
    "hx-content",
  );
  const { document: layoutDoc } = parseHTML(layoutTemplateSrc);
  const htmxContentElement = layoutDoc.querySelector("hx-content");

  if (htmxContentElement) {
    htmxContentElement.innerHTML = content;
    return layoutDoc.toString();
  }

  return layoutTemplateSrc + content;
}

export async function composeHtmlLayout({
  pageContent,
  layoutFilePath,
  rootLayoutFilePath,
  appPath,
  isRoot,
  dataContext = {},
}: TemplateOptions): Promise<string> {
  const safePageContent = await processImportElements(pageContent, appPath);
  let finalBodyHtml = safePageContent;

  if (layoutFilePath) {
    finalBodyHtml = await applyLayout(finalBodyHtml, layoutFilePath, appPath);
  }

  // A "partialLayout.htmx" nests inside the root pages/layout.htmx rather
  // than replacing it - router.ts only sets this when the matched layout
  // was a partial, so this wraps the partial's own output one more time.
  if (rootLayoutFilePath) {
    finalBodyHtml = await applyLayout(
      finalBodyHtml,
      rootLayoutFilePath,
      appPath,
    );
  }

  const rootShellPath = join(process.cwd(), appPath, "pages", "index.htmx");
  const globalRootFile = Bun.file(rootShellPath);
  let fullRawHtml = finalBodyHtml;

  if (await globalRootFile.exists()) {
    const globalRootTemplateSrc = closeSelfClosingTag(
      await processImportElements(await globalRootFile.text(), appPath),
      "hx-root",
    );
    const { document: rootDoc } = parseHTML(globalRootTemplateSrc);

    if (rootDoc.head && !rootDoc.querySelector('script[src="/htmx.js"]')) {
      const scriptEl = rootDoc.createElement("script");
      scriptEl.setAttribute("src", "/htmx.js");
      rootDoc.head.appendChild(scriptEl);
    }

    const htmxRootElement = rootDoc.querySelector("hx-root");

    if (htmxRootElement) {
      htmxRootElement.innerHTML = finalBodyHtml;
      fullRawHtml = rootDoc.toString();
    } else {
      fullRawHtml = globalRootTemplateSrc;
    }
  }

  fullRawHtml = fullRawHtml.replace(
    /\{\{PARTIAL:([a-zA-Z_][\w-]*):([A-Za-z0-9+/=]*)\}\}/g,
    (_m, name, encodedAttrs) => {
      const attrs = Buffer.from(encodedAttrs, "base64").toString("utf-8");
      return `{{> ${name}${attrs ? " " + attrs : ""}}}`;
    },
  );

  try {
    const template = Handlebars.compile(fullRawHtml);
    fullRawHtml = template(dataContext);
  } catch (e) {
    console.error("Hitmix Handlebars compilation failed:", e);
  }

  return fullRawHtml;
}

function parseTagAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][-\w:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(attrString)) !== null) {
    const name = match[1];
    if (!name) continue;
    attrs[name] = match[3] ?? match[4] ?? "";
  }

  return attrs;
}

async function resolveImportSource(
  srcPath: string,
  appPath: string,
): Promise<string | null> {
  let componentPath = srcPath;

  if (componentPath.startsWith("@/")) {
    componentPath = componentPath.replace("@/", `${appPath}/`);
  } else {
  componentPath = join('node_modules', componentPath);
      console.log('component path',componentPath)
  }

  let fileTarget = join(process.cwd(), `${componentPath}.htmx`);
  let componentFile = Bun.file(fileTarget);

  if (await componentFile.exists()) {
    return await componentFile.text();
  }

  return null;
}

async function processImportElements(
  htmlSrc: string,
  appPath: string,
): Promise<string> {
  const importTagRegex = /<import\s+([^>]*?)\/?>\s*(?:<\/import>)?/gi;
  const imports: { src: string; as: string }[] = [];
  let html = htmlSrc.replace(importTagRegex, (match, attrString) => {
    const attrs = parseTagAttributes(attrString);
    const src = attrs.src;
    const as = attrs.as;

    if (src && as) {
      imports.push({ src, as });
    } else {
      console.warn(
        `⚠️ <import> tag requires both "src" and "as" attributes: ${match}`,
      );
    }

    return "";
  });

  for (const { src, as } of imports) {
    const componentSrc = await resolveImportSource(src, appPath);

    if (!componentSrc) {
      console.warn(`⚠️ Imported component file target missing: ${src}`);
      continue;
    }

    Handlebars.registerPartial(as, componentSrc);
    const usageRegex = new RegExp(`<${as}\\b([^>]*?)\\/>`, "gi");
    html = html.replace(usageRegex, (_match, attrString) => {
      const trimmedAttrs = attrString.trim();
      const encodedAttrs = Buffer.from(trimmedAttrs, "utf-8").toString(
        "base64",
      );
      return `{{PARTIAL:${as}:${encodedAttrs}}}`;
    });
  }

  return html;
}
