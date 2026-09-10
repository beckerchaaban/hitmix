# Hitmix

A tiny Bun + [htmx](https://htmx.org) + Handlebars web framework: file-based routing, `.htmx` page templates, and reusable components via `<import src="..." as="name"/>`.

## Getting started

```bash
mkdir my-app && cd my-app
bun init -y
bun add hitmix htmx.org
bun add -d @tailwindcss/cli @types/bun sass tailwindcss typescript
```

Add these scripts to `package.json`:

```json
"scripts": {
  "dev": "bun run --filter='*' dev:server dev:css",
  "dev:server": "bun --watch index.ts",
  "dev:css": "bunx @tailwindcss/cli -i ./app/styles/main.scss -o ./public/styles/output.css --watch",
  "build": "bun build ./index.ts --outfile=./dist/bootstrap.js --target node"
}
```

Replace `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "jsxImportSource": "hitmix",
    "allowJs": true,
    "types": ["bun"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

`jsxImportSource: "hitmix"` is what makes `.tsx` handlers work — Bun resolves JSX to `hitmix`'s own runtime automatically. Everything else you need is a normal import from `"hitmix"`.

Create `index.ts` at the project root:

```ts
import { serve } from "hitmix";

serve();
```

`serve()` wraps `Bun.serve`: it serves static files from `./public`, serves `/htmx.js` from `htmx.org`, routes everything else through the file-based router, and logs requests. Pass `{ port: 4000 }` to change the port (defaults to `3000`).

Then add the app files below, and run:

```bash
bun run dev
```

Open http://localhost:3000.

### App files

`app/pages/index.htmx` — the root HTML shell:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>my-app</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link href="/styles/output.css" rel="stylesheet" />
  </head>
  <body class="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased">
    <hx-root />
  </body>
</html>
```

`app/pages/layout.htmx` — the root layout, wrapping every page:

```html
<main>
  <hx-content />
</main>
```

`app/pages/home/home.htmx` — the home page template:

```html
<import src="@/components/button" as="hitmix-button"/>
<div class="mx-auto max-w-3xl px-6 py-20">
  <h1 class="text-4xl font-semibold tracking-tight">{{title}}</h1>
  <p class="mt-4 text-zinc-400">
    Edit <code class="rounded bg-white/10 px-1.5 py-0.5 text-sm">app/pages/home/home.htmx</code> to get started.
  </p>

  <div class="mt-10 flex items-center gap-4">
    <hitmix-button
      hx-post="/"
      hx-target="#greeting-result"
      hx-swap="innerHTML"
      label="Say hello"
    />
    <div id="greeting-result" class="text-zinc-300"></div>
  </div>
</div>
```

`app/pages/home/home.tsx` — its handler:

```tsx
import { page, get, post } from "hitmix";
import type { RouterArgs } from "hitmix";

export default page([
  get(async () => {
    return { title: "Welcome to my-app" };
  }),
  post(async (_args: RouterArgs) => {
    return (
      <span class="inline-flex items-center gap-2 text-emerald-400">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
        Hello from the server 👋
      </span>
    );
  }),
]);
```

`app/components/button.htmx` — a reusable component that forwards `hx-*` props:

```html
<button
  class="inline-flex items-center justify-center rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-90 active:scale-[0.98]"
  {{#if hx-post}}hx-post="{{hx-post}}"{{/if}}
  {{#if hx-target}}hx-target="{{hx-target}}"{{/if}}
  {{#if hx-swap}}hx-swap="{{hx-swap}}"{{/if}}
  {{#if hx-vals}}hx-vals='{{{hx-vals}}}'{{/if}}
>{{#if label}}{{label}}{{else}}Click me{{/if}}</button>
```

`app/styles/main.scss`:

```scss
@import "tailwindcss";
```

## Local development (this repo)

This repo ships the framework (`src/`) only — it has no `app/` of its own. To try changes to `src/` against a running app without publishing first, link the package locally:

```bash
bun install
bun link   # registers this repo as the local `hitmix` package
```

Then follow "Getting started" above in a scratch directory, but run `bun add link:hitmix` instead of `bun add hitmix` so `node_modules/hitmix` points at this checkout. Changes to this repo's `src/` are picked up on the next request via `--watch`.

## Project structure

- `app/pages` — file-based routes. `app/pages/<folder>/<folder>.htmx` is the template, `<folder>.tsx` (exporting `page([get(...), post(...)])`) is the optional handler.
- `app/pages/layout.htmx` — the root layout, wrapping every page's `<hx-content/>` slot.
- `app/pages/index.htmx` — the root HTML shell, wrapping the `<hx-root/>` slot.
- `app/components` — reusable `.htmx` fragments, pulled into a page or layout with `<import src="@/components/x" as="x"/>` then used as `<x />`. Props passed on the usage tag (including `hx-*` attributes) are available inside the component via `{{propName}}`.
- `src` — the framework itself, published as the `hitmix` package: `routing/` (router + route helpers), `templating/` (the `.htmx` + Handlebars compose pipeline), `jsx-runtime/` (lets `.tsx` handlers return JSX strings). A project imports its public API with a plain `import ... from "hitmix"`.

Note: the `@/` in `<import src="@/components/x" as="x"/>` is unrelated to the `hitmix` package — it's the templating engine's own shorthand for "this project's `app/`" directory, resolved by string substitution, not by module resolution.
