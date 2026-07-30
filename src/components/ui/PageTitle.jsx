import React from 'react';
import { cn } from '../../lib/utils.js';

/**
 * A route's own visible page title.
 *
 * Hidden on mobile, where the app bar already names the page. Showing both
 * spent two rows of a small screen saying where you are — a "Heritage Tree"
 * heading directly under a bar that also read "Heritage Tree".
 *
 * Only for the heading that repeats the page name. Section headings inside a
 * page ("Export", "Restore", "API connection") are not this, and stay put —
 * they carry information the bar does not.
 *
 * The <h1> lives in the shell either way, so this is an <h2> at every
 * breakpoint and hiding it never leaves the page unlabelled: on mobile the
 * bar's heading is the accessible name, on desktop the shell's sr-only one is.
 */
export function PageTitle({ className, children, ...props }) {
  return (
    <h2 className={cn('hidden md:block', className)} {...props}>
      {children}
    </h2>
  );
}

export default PageTitle;
