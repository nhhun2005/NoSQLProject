import { useEffect, useRef } from 'react';
export default function AccessibleDialog({
  children,
  label,
  onClose,
  className = ''
}) {
  const ref = useRef(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement,
      root = ref.current;
    const controls = () => [...root.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length);
    (controls()[0] || root).focus();
    const keydown = event => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        closeRef.current?.();
      }
      if (event.key === 'Tab') {
        event.stopPropagation();
        const list = controls();
        if (!list.length) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && (document.activeElement === list[0] || document.activeElement === root)) {
          event.preventDefault();
          list.at(-1).focus();
        } else if (!event.shiftKey && document.activeElement === list.at(-1)) {
          event.preventDefault();
          list[0].focus();
        }
      }
    };
    root.addEventListener('keydown', keydown);
    return () => {
      root.removeEventListener('keydown', keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={className}>{children}</div>;
}
