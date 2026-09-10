// src/types/router.t.ts

export interface RouterResponse {
  trigger(events: Record<string, any>): void;
  triggerAfterReceive(events: Record<string, any>): void;
  triggerAfterSwap(events: Record<string, any>): void;
  header(key: string, value: string): void;
  status(code: number): RouterResponse; 
  redirect(url: string): void; 
  location(url: string): void; 
  pushUrl(url: string): void; 
  reswap(option: string): void;
}

// 🚀 FIX: Ta bort frågetecknen (?) från params, query och body.
// Routern skickar alltid med objekt, så de är ALDRIG undefined på rotnivå!
export interface RouterArgs<
  TParams = Record<string, string | undefined>, 
  TQuery = Record<string, string | undefined>, 
  TBody = Record<string, string | undefined>
> {
  req: Request;
  res: RouterResponse;
  params: TParams; 
  query: TQuery;
  body: TBody;
}

// Våra smarta och rena genvägar förblir exakt likadana
export type ActionArgs<TBody> = RouterArgs<Record<string, string | undefined>, Record<string, string | undefined>, TBody>;
export type ParamArgs<TParams> = RouterArgs<TParams, Record<string, string | undefined>, Record<string, string | undefined>>;
