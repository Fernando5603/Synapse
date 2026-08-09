"use client";

import { LogOut } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";

/**
 * Salir de la sala.
 *
 * Confirma antes porque salir también olvida el nombre: la sesión siguiente vuelve a
 * pedirlo, que es lo que hace falta para pasarle el portátil a otra persona en una demo,
 * pero sería un accidente feo si el botón fuera directo.
 */
export default function LeaveRoom({ displayName, onLeave }: { displayName: string; onLeave: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Salir de la sala">
          <LogOut className="h-3.5 w-3.5" />
          Salir
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogTitle>¿Salir de la sala?</DialogTitle>
        <DialogDescription>
          Dejarás de aparecer en el roster y se olvidará el nombre «{displayName}». La
          conversación y el grafo siguen ahí para quien se quede, y puedes volver a entrar
          cuando quieras.
        </DialogDescription>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Quedarme
            </Button>
          </DialogClose>
          <Button variant="destructive" size="sm" onClick={onLeave}>
            <LogOut className="h-3.5 w-3.5" />
            Salir de la sala
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
