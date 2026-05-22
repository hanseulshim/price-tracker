"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
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
import { createCategory, updateCategory, deleteCategory } from "@/actions/categories";
import { useRouter } from "next/navigation";

type CategoryWithCount = {
  id: number;
  name: string;
  _count: { items: number };
};

export function CategoryList({ categories }: { categories: CategoryWithCount[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<CategoryWithCount | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setName("");
    setDialogOpen(true);
  }

  function openEdit(cat: CategoryWithCount) {
    setEditing(cat);
    setName(cat.name);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, name.trim());
        toast.success("Category updated");
      } else {
        await createCategory(name.trim());
        toast.success("Category added");
      }
      setDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteCategory(id);
      toast.success("Category deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete — category may have items");
    }
    setDeleteId(null);
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Tag className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No categories yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <Card key={cat.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{cat.name}</span>
                  <Badge variant="secondary" className="text-xs">{cat._count.items}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(cat.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="cat-name">Name *</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Produce, Dairy & Eggs"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Categories with items cannot be deleted. Move or delete items first.
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
