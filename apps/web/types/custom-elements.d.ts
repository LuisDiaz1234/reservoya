// Declaración del Web Component de Yappy para TypeScript/JSX.
// Con esto, <btn-yappy ... /> será válido en el build.

import type React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "btn-yappy": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        theme?: string;
        rounded?: string | boolean;
      };
    }
  }
}

export {};
