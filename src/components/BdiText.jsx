import React from 'react';

export function BdiText({ as: Component = 'bdi', dir = 'auto', children, ...props }) {
  return (
    <Component dir={dir} {...props}>
      {children}
    </Component>
  );
}

export default BdiText;
