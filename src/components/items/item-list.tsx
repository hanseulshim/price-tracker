"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Tag, RefreshCw } from "lucide-react";
import Image from "next/image";
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
import { createItem, updateItem, deleteItem, syncCostcoItemNames } from "@/actions/items";
import { PriceHistoryDialog } from "./price-history-dialog";
import { useRouter } from "next/navigation";

type Item = {
  id: number;
  name: string;
  unit: string | null;
  size: number | null;
  imageUrl: string | null;
  categoryId: number;
  category: { id: number; name: string };
  _count: { prices: number };
};

type Category = { id: number; name: string; _count: { items: number } };

export function ItemList({
  items,
  categories,
}: {
  items: Item[];
  categories: Category[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyItem, setHistoryItem] = useState<Item | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  async function handleSyncCostco() {
    setSyncing(true);
    try {
      const result = await syncCostcoItemNames();
      toast.success(`Updated ${result.updated} item${result.updated !== 1 ? "s" : ""} from Costco lookup`);
      router.refresh();
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  // Form state
  const [formName, setFormName] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formSize, setFormSize] = useState("");
  const [formCategoryId, setFormCategoryId] = useState<number>(categories[0]?.id ?? 0);

  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormUnit("");
    setFormSize("");
    setFormCategoryId(categories[0]?.id ?? 0);
    setDialogOpen(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setFormName(item.name);
    setFormUnit(item.unit ?? "");
    setFormSize(item.size != null ? String(item.size) : "");
    setFormCategoryId(item.categoryId);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formCategoryId) return;
    setSaving(true);
    try {
      const data = {
        name: formName.trim(),
        unit: formUnit.trim() || undefined,
        size: formSize.trim() ? parseFloat(formSize.trim()) : undefined,
        categoryId: formCategoryId,
      };
      if (editing) {
        await updateItem(editing.id, data);
        toast.success("Item updated");
      } else {
        await createItem(data);
        toast.success("Item added");
      }
      setDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to save item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteItem(id);
      toast.success("Item deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete item");
    }
    setDeleteId(null);
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      for (const id of selected) {
        await deleteItem(id);
      }
      toast.success(`Deleted ${selected.size} item${selected.size !== 1 ? "s" : ""}`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete some items");
    } finally {
      setBulkDeleting(false);
    }
  }

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q);
    const matchesCat = !filterCat || item.categoryId === filterCat;
    return matchesSearch && matchesCat;
  });

  // Clear selection when filtered list changes (search/filter change)
  useEffect(() => {
    setSelected(new Set());
  }, [filtered.length, search, filterCat]);

  // Update select-all checkbox indeterminate state
  useEffect(() => {
    if (selectAllRef.current) {
      const allSelected = filtered.length > 0 && filtered.every(i => selected.has(i.id));
      const someSelected = filtered.some(i => selected.has(i.id));
      selectAllRef.current.checked = allSelected;
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [selected, filtered]);

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background text-foreground"
            value={filterCat ?? ""}
            onChange={(e) => setFilterCat(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
          <Button onClick={handleSyncCostco} size="sm" variant="outline" disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Costco Names"}
          </Button>
          {selected.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete {selected.size} selected
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Tag className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              {items.length === 0 ? "No items yet. Add your first item!" : "No items match your search."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="py-3 px-4 w-8">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="rounded"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected(new Set(filtered.map(i => i.id)));
                      } else {
                        setSelected(new Set());
                      }
                    }}
                  />
                </th>
                <th className="text-left py-3 px-4 font-medium">Item</th>
                <th className="text-left py-3 px-4 font-medium hidden sm:table-cell">Category</th>
                <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Unit</th>
                <th className="text-left py-3 px-4 font-medium">Prices</th>
                <th className="w-20 py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t hover:bg-muted/30">
                  <td className="py-3 px-4 w-8">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selected.has(item.id)}
                      onChange={(e) => {
                        setSelected(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(item.id);
                          else next.delete(item.id);
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {item.imageUrl && (
                        <Image src={item.imageUrl} alt={item.name} width={28} height={28} className="rounded object-contain flex-shrink-0" unoptimized />
                      )}
                      <button
                        className="font-medium text-left hover:text-primary hover:underline transition-colors"
                        onClick={() => setHistoryItem(item)}
                      >
                        {item.name}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden sm:table-cell">
                    <Badge variant="outline" className="text-xs">{item.category.name}</Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                    {item.size != null && item.unit ? `${item.size} ${item.unit}` : (item.unit ?? "—")}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="secondary" className="text-xs">{item._count.prices}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Item" : "Add Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Name *</Label>
              <Input id="item-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Whole Milk, Chicken Breast" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-unit">Unit</Label>
                <Input id="item-unit" value={formUnit} onChange={(e) => setFormUnit(e.target.value)} placeholder="oz, lb, ct" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-size">Size</Label>
                <Input id="item-size" type="number" value={formSize} onChange={(e) => setFormSize(e.target.value)} placeholder="e.g. 32" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-category">Category *</Label>
                <select
                  id="item-category"
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(Number(e.target.value))}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formName.trim() || !formCategoryId || saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the item and all its price history. This cannot be undone.
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
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(o) => !o && setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} item{selected.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the selected items and all their price history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PriceHistoryDialog
        itemId={historyItem?.id ?? null}
        itemName={historyItem?.name ?? ""}
        open={historyItem !== null}
        onClose={() => setHistoryItem(null)}
      />
    </>
  );
}
