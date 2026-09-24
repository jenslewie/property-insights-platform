"use client";

import { useEffect, useRef } from "react";

type Props = {
  children: React.ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
};

function setDialogOpen(dialog: HTMLDialogElement, open: boolean) {
  if (open && !dialog.open) {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  } else if (!open && dialog.open) {
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }
}

export function SideDrawer({ children, onClose, open, title }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = `drawer-title-${title.toLowerCase().replaceAll(" ", "-")}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previousFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setDialogOpen(dialog, true);
      dialog.querySelector<HTMLElement>("[data-drawer-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      setDialogOpen(dialog, false);
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-y-0 right-0 m-0 h-dvh max-h-dvh w-full max-w-xl border-0 bg-transparent p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/40"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={dialogRef}
    >
      <div className="flex h-full flex-col overflow-hidden bg-white">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold" id={titleId}>
              {title}
            </h2>
          </div>
          <button
            aria-label={`Close ${title}`}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </dialog>
  );
}
