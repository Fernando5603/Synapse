"use client";

import { useState } from "react";

export default function SessionDoc({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false);

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sesion.md";
    anchor.click();
    // Revocar en el tick siguiente: revocar síncrono puede competir con el arranque
    // de la descarga en algunos navegadores.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ padding: "8px 16px" }}
      >
        Cerrar sesión
      </button>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              maxWidth: 720,
              width: "90%",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: 8,
              padding: 20,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Documento de la sesión</h2>
              <button
                type="button"
                onClick={download}
                style={{ padding: "6px 14px" }}
              >
                Descargar .md
              </button>
            </div>
            <pre
              style={{
                flex: 1,
                overflowY: "auto",
                margin: 0,
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {markdown}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
