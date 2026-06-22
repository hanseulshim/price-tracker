"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createStore, updateStore, deleteStore } from "@/actions/stores";
import { useRouter } from "next/navigation";

type StoreWithCount = {
  id: number;
  name: string;
  location: string | null;
  createdAt: Date;
  _count: { prices: number; receipts: number };
};

export function StoreList({ stores }: { stores: StoreWithCount[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<StoreWithCount | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setName("");
    setLocation("");
    setDialogOpen(true);
  }

  function openEdit(store: StoreWithCount) {
    setEditing(store);
    setName(store.name);
    setLocation(store.location ?? "");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateStore(editing.id, { name: name.trim(), location: location.trim() || undefined });
        toast.success("Store updated");
      } else {
        await createStore({ name: name.trim(), location: location.trim() || undefined });
        toast.success("Store added");
      }
      setDialogOpen(false);
      router.refresh();
    } catch (e) {
      toast.error("Failed to save store");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteStore(id);
      toast.success("Store deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete store");
    }
    setDeleteId(null);
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Store
        </Button>
      </div>

      {stores.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Store className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No stores yet. Add the stores you shop at — like Costco, Walmart, or Lidl.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {stores.map((store) => (
            <Card key={store.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{store.name}</h3>
                    {store.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {store.location}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {store._count.prices} prices
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {store._count.receipts} receipts
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(store)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(store.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Store" : "Add Store"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="store-name">Name *</Label>
              <Input
                id="store-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Costco, Walmart, Lidl"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-location">Location (optional)</Label>
              <Input
                id="store-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. 123 Main St"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Store"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Store?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the store and all its associated price data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
