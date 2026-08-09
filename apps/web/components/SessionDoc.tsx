"use client";

import { Download, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";

/**
 * El documento de la sesión: criterio (c).
 *
 * Se llama «Finalizar sesión» y no «Cerrar sesión» a propósito. Lo segundo, en cualquier
 * otra aplicación, significa salir de tu cuenta — y aquí abría un markdown. Salir de la
 * sala es otro botón (`LeaveRoom`).
 */
export default function SessionDoc({ markdown }: { markdown: string }) {
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
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" title="Ver el documento de la sesión">
          <FileText className="h-3.5 w-3.5" />
          Finalizar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <div className="flex items-start justify-between gap-4 pr-8">
          <div>
            <DialogTitle>Documento de la sesión</DialogTitle>
            <DialogDescription>
              Ideas, relaciones y conclusiones, generadas desde el grafo.
            </DialogDescription>
          </div>
          <Button size="sm" onClick={download}>
            <Download className="h-3.5 w-3.5" />
            Descargar .md
          </Button>
        </div>
        <pre className="flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background/60 p-4 font-sans text-sm leading-relaxed">
          {markdown}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
