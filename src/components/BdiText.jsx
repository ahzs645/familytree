import React from 'react';

export function BdiText({ as: Component = 'bdi', dir = 'auto', children, ...props }) {
  return (
    <Component dir={dir} {...props}>
      {children}
    </Component>
  );
}

export function LtrText({ as: Component = 'bdi', children, ...props }) {
  return (
    <Component dir="ltr" {...props}>
      {children}
    </Component>
  );
}

export default BdiText;
