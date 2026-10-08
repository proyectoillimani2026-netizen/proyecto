"use client";

import { useState } from "react";

export function ConfirmDelete({ prompt, onConfirm }: { prompt: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="text-btn danger" type="button" onClick={() => setOpen(true)}>
        Borrar
      </button>
    );
  }
  return (
    <span className="confirm-frame">
      <span>{prompt}</span>
      <button className="text-btn danger" type="button" onClick={() => { setOpen(false); onConfirm(); }}>Borrar</button>
      <button className="text-btn" type="button" onClick={() => setOpen(false)}>Cancelar</button>
    </span>
  );
}
