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
  anchorRect: DOMRect | null;
  isOpen: boolean;
  open: (element: HoverBindableElement) => void;
  close: () => void;
  bind: <T extends HoverBindableElement>() => HoverAnchorBindings<T>;
};

const getRectFromElement = (element: HoverBindableElement): DOMRect =>
  element.getBoundingClientRect();

export function useHoverAnchor(): UseHoverAnchorResult {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((element: HoverBindableElement) => {
    setAnchorRect(getRectFromElement(element));
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const bind = useCallback(
    <T extends HoverBindableElement>(): HoverAnchorBindings<T> => ({
      onMouseEnter: (event) => {
        open(event.currentTarget);
      },
      onMouseLeave: () => {
        close();
      },
      onFocus: (event) => {
        open(event.currentTarget);
      },
      onBlur: () => {
        close();
      },
    }),
    [close, open],
  );

  return useMemo(
    () => ({
      anchorRect,
      isOpen,
      open,
      close,
      bind,
    }),
    [anchorRect, bind, close, isOpen, open],
  );
}
