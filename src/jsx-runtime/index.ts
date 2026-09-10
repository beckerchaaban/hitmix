export function jsx(tag: any, props: any): string {
  if (typeof tag === "function") {
    return tag(props);
  }

  const cleanProps = { ...props };
  let children: any[] = [];

  if ("children" in cleanProps) {
    children = Array.isArray(cleanProps.children) ? cleanProps.children : [cleanProps.children];
    delete cleanProps.children;
  }

  const attributeString = Object.entries(cleanProps)
    .map(([key, val]) => {
      if (typeof val === "object" && val !== null) {
        const jsonStr = JSON.stringify(val);
        return ` ${key}='${jsonStr}'`;
      }
      
      return ` ${key}="${val}"`;
    })
    .join("");

  const content = children
    .flat()
    .map((child) => (child === null || child === undefined ? "" : String(child)))
    .join("");

  return `<${tag}${attributeString}>${content}</${tag}>`;
}

export const jsxs = jsx;

export function Fragment(props: any): string {
  if (!props || !props.children) return "";
  return Array.isArray(props.children) ? props.children.flat().join("") : String(props.children);
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    interface Element extends String {}
  }
}
