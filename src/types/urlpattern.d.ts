// URLPattern is a runtime global provided by Bun, but is not declared by
// bun-types (it only lives in TypeScript's "DOM" lib, which this project
// doesn't include). Declare the minimal shape actually used by the router.
declare class URLPattern {
  constructor(init: { pathname?: string; [key: string]: string | undefined });
  exec(input: string | URL): {
    pathname: { groups: Record<string, string | undefined> };
  } | null;
}
