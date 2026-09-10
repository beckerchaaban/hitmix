export function page(endpoints: any[]) {
 return endpoints;
}

export const get = (handler: Function, route?: string) => Object.assign(handler, { route, method: "GET" });
export const post = (handler: Function, route?: string) => Object.assign(handler, { route, method: "POST" });
export const patch = (handler: Function, route?: string) => Object.assign(handler, { route, method: "PATCH" });
export const put = (handler: Function, route?: string) => Object.assign(handler, { route, method: "PUT" });
export const del = (handler: Function, route?: string) => Object.assign(handler, { route, method: "DELETE" });
