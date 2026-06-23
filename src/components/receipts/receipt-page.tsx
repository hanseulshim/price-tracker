"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { FileText, Upload, Trash2, ChevronDown, ChevronUp, MapPin, BarChart2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { deleteReceipt, getReceipt, updateReceipt } from "@/actions/receipts";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Store = { id: number; name: string };

type Receipt = {
  id: number;
  date: Date;
  storeId: number;
  store: { id: number; name: string };
  orderNumber: string | null;
  addressLine1: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  notes: string | null;
  _count: { items: number };
  items: Array<{ price: number; quantity: number | null }>;
};

export function ReceiptPage({
  receipts,
  stores,
}: {
  receipts: Receipt[];
  stores: Store[];
}) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  type ReceiptDetail = Awaited<ReturnType<typeof getReceipt>>;
  const [expandedDetails, setExpandedDetails] = useState<Record<number, ReceiptDetail>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [showSpend, setShowSpend] = useState(false);

  // Edit receipt state
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null);
  const [editStoreId, setEditStoreId] = useState(0);
  const [editDate, setEditDate] = useState("");
  const [editOrderNumber, setEditOrderNumber] = useState("");
  const [editAddressLine1, setEditAddressLine1] = useState("");
  const [editAddressCity, setEditAddressCity] = useState("");
  const [editAddressState, setEditAddressState] = useState("");
  const [editAddressZip, setEditAddressZip] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function openEditReceipt(r: Receipt) {
    setEditReceipt(r);
    setEditStoreId(r.storeId);
    const d = new Date(r.date);
    setEditDate(d.toISOString().split("T")[0]);
    setEditOrderNumber(r.orderNumber ?? "");
    setEditAddressLine1(r.addressLine1 ?? "");
    setEditAddressCity(r.addressCity ?? "");
    setEditAddressState(r.addressState ?? "");
    setEditAddressZip(r.addressZip ?? "");
    setEditNotes(r.notes ?? "");
  }

  async function handleEditSave() {
    if (!editReceipt) return;
    setEditSaving(true);
    try {
      await updateReceipt(editReceipt.id, {
        storeId: editStoreId,
        date: new Date(editDate + "T12:00:00"),
        orderNumber: editOrderNumber || undefined,
        addressLine1: editAddressLine1 || undefined,
        addressCity: editAddressCity || undefined,
        addressState: editAddressState || undefined,
        addressZip: editAddressZip || undefined,
        notes: editNotes || undefined,
      });
      toast.success("Receipt updated");
      setEditReceipt(null);
      router.refresh();
    } catch {
      toast.error("Failed to update receipt");
    } finally {
      setEditSaving(false);
    }
  }

  // Spend chart data: group receipts by month + store
  const spendChartData = useMemo(() => {
    const STORE_COLORS = ["#4f86c6", "#e07b54", "#5cb85c", "#9b59b6", "#f0ad4e", "#1abc9c"];
    const monthMap = new Map<string, Record<string, number>>();
    for (const r of receipts) {
      const d = new Date(r.date);
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const total = r.items.reduce((sum, item) => sum + item.price * (item.quantity ?? 1), 0);
      if (!monthMap.has(month)) monthMap.set(month, {});
      const m = monthMap.get(month)!;
      m[r.store.name] = (m[r.store.name] ?? 0) + total;
    }
    const sorted = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const storeNames = [...new Set(receipts.map((r) => r.store.name))];
    return {
      data: sorted.map(([month, storeData]) => ({ month, ...storeData })),
      storeNames,
      colors: STORE_COLORS,
    };
  }, [receipts]);

  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!expandedDetails[id]) {
      setLoadingId(id);
      const detail = await getReceipt(id);
      setExpandedDetails((prev) => ({ ...prev, [id]: detail }));
      setLoadingId(null);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteReceipt(id);
      toast.success("Receipt deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete receipt");
    }
    setDeleteId(null);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowSpend((v) => !v)}
        >
          <BarChart2 className="h-4 w-4" />
          {showSpend ? "Hide Spending" : "Show Spending"}
          {showSpend ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <Link
          href="/receipts/import"
          className={cn(buttonVariants({ size: "sm" }), "gap-1")}
        >
          <Upload className="h-4 w-4" /> Import Receipt
        </Link>
      </div>

      {showSpend && receipts.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Monthly Spending by Store</p>
              <p className="text-xs text-muted-foreground">
                Total: ${receipts.reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0), 0).toFixed(2)}
              </p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={spendChartData.data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(value) => typeof value === "number" ? `$${value.toFixed(2)}` : value} />
                <Legend />
                {spendChartData.storeNames.map((name, idx) => (
                  <Bar key={name} dataKey={name} stackId="a" fill={spendChartData.colors[idx % spendChartData.colors.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {receipts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No receipts yet. Import your first receipt!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {receipts.map((r) => {
            const addrParts = [r.addressLine1, r.addressCity && r.addressState ? `${r.addressCity}, ${r.addressState}` : (r.addressCity ?? r.addressState), r.addressZip].filter(Boolean);
            const addrStr = addrParts.join(" ");
            return (
              <Card key={r.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        className="flex items-center gap-2 text-left"
                        onClick={() => toggleExpand(r.id)}
                      >
                        {expandedId === r.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <span className="font-medium">{r.store.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {new Date(r.date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          {r.orderNumber && (
                            <span className="text-xs text-muted-foreground ml-2">#{r.orderNumber}</span>
                          )}
                          {addrStr && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{addrStr}</span>
                            </div>
                          )}
                        </div>
                      </button>
                      <Badge variant="secondary" className="text-xs">{r._count.items} items</Badge>
                      <Badge variant="outline" className="text-xs text-primary">${r.items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0).toFixed(2)}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openEditReceipt(r)}
                        title="Edit receipt"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(r.id)}
                        title="Delete receipt"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
                {expandedId === r.id && (
                  <div className="border-t px-4 pb-3">
                    {loadingId === r.id ? (
                      <p className="text-sm text-muted-foreground py-3">Loading…</p>
                    ) : expandedDetails[r.id]?.items.length ? (
                      <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-sm mt-3 min-w-[400px]">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground border-b">
                            <th className="pb-1 font-medium">Item</th>
                            <th className="pb-1 font-medium">Category</th>
                            <th className="pb-1 font-medium text-right">Qty</th>
                            <th className="pb-1 font-medium text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expandedDetails[r.id]!.items.map((ri) => (
                            <tr key={ri.id} className="border-b last:border-0">
                              <td className="py-1.5 pr-3">
                                <span className="font-medium">{ri.item?.name ?? ri.rawName}</span>
                              </td>
                              <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                                {ri.item?.category?.name ?? "—"}
                              </td>
                              <td className="py-1.5 pr-3 text-right text-muted-foreground">{ri.quantity ?? 1}</td>
                              <td className="py-1.5 text-right font-medium text-foreground">${ri.price.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-3">No items found.</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Receipt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the receipt and all price entries imported from it. This cannot be undone.
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

      {/* Edit Receipt Dialog */}
      <Dialog open={editReceipt !== null} onOpenChange={(o) => !o && setEditReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Store</Label>
              <div className="flex flex-wrap gap-2">
                {stores.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-sm font-medium transition-colors",
                      editStoreId === s.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    )}
                    onClick={() => setEditStoreId(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-date">Date</Label>
                <Input id="edit-date" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-order">Order #</Label>
                <Input id="edit-order" value={editOrderNumber} onChange={(e) => setEditOrderNumber(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-addr1">Street Address</Label>
              <Input id="edit-addr1" value={editAddressLine1} onChange={(e) => setEditAddressLine1(e.target.value)} placeholder="123 Main St" />
            </div>
            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-3 space-y-1.5">
                <Label htmlFor="edit-city">City</Label>
                <Input id="edit-city" value={editAddressCity} onChange={(e) => setEditAddressCity(e.target.value)} />
              </div>
              <div className="col-span-1 space-y-1.5">
                <Label htmlFor="edit-state">State</Label>
                <Input id="edit-state" value={editAddressState} onChange={(e) => setEditAddressState(e.target.value)} maxLength={2} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit-zip">ZIP</Label>
                <Input id="edit-zip" value={editAddressZip} onChange={(e) => setEditAddressZip(e.target.value)} maxLength={10} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">Notes</Label>
              <Input id="edit-notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditReceipt(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
