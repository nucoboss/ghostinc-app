import * as React from "react";

export default function Link(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { href, children, ...rest } = props;
  return (
    <a href={typeof href === "string" ? href : undefined} {...rest}>
      {children}
    </a>
  );
}
