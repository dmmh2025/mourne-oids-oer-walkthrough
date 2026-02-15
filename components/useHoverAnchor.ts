import type React from "react";
import { useCallback, useMemo, useState } from "react";

type HoverBindableElement = HTMLElement;

type HoverAnchorBindings<T extends HoverBindableElement> = {
  onMouseEnter: (event: React.MouseEvent<T>) => void;
  onMouseLeave: () => void;
  onFocus: (event: React.FocusEvent<T>) => void;
  onBlur: () => void;
};

export type UseHoverAnchorResult = {
  rect: DOMRect | null;
  open: boolean;
  bind: <T extends HoverBindableElement>() => HoverAnchorBindings<T>;
  show: (element: HoverBindableElement) => void;
  hide: () => void;
};

export function useHoverAnchor(): UseHoverAnchorResult {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [open, setOpen] = useState(false);

  const show = useCallback((element: HoverBindableElement) => {
    setRect(element.getBoundingClientRect());
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  const bind = useCallback(
    <T extends HoverBindableElement>(): HoverAnchorBindings<T> => ({
      onMouseEnter: (event) => {
        show(event.currentTarget);
      },
      onMouseLeave: () => {
        hide();
      },
      onFocus: (event) => {
        show(event.currentTarget);
      },
      onBlur: () => {
        hide();
      },
    }),
    [hide, show],
  );

  return useMemo(
    () => ({
      rect,
      open,
      bind,
      show,
      hide,
    }),
    [bind, hide, open, rect, show],
  );
}
