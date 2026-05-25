"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Upload, Trash2, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { parseReceipt, importReceipt, deleteReceipt, getReceipt } from "@/actions/receipts";
import { createItem } from "@/actions/items";
import { stripBrandPrefix, normalizeName, guessCategory } from "@/lib/brand-utils";
import { useRouter } from "next/navigation";

type Store = { id: number; name: string };
type Category = { id: number; name: string; _count: { items: number } };
type Item = {
  id: number;
  name: string;
  category: { id: number; name: string };
};

type ParsedItem = { rawName: string; price: number; quantity?: number };

type Receipt = {
  id: number;
  date: Date;
  store: { name: string };
  orderNumber: string | null;
  notes: string | null;
  _count: { items: number };
};

export function ReceiptPage({
  receipts,
  stores,
  categories,
  items,
}: {
  receipts: Receipt[];
  stores: Store[];
  categories: Category[];
  items: Item[];
}) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Import wizard state
  const [step, setStep] = useState<"paste" | "review">("paste");
  const [rawText, setRawText] = useState("");
  const [storeId, setStoreId] = useState<number>(stores[0]?.id ?? 0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [matchedItems, setMatchedItems] = useState<(number | "new" | "skip")[]>([]);
  const [newItemNames, setNewItemNames] = useState<string[]>([]);
  const [newItemCategories, setNewItemCategories] = useState<number[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  type ReceiptDetail = Awaited<ReturnType<typeof getReceipt>>;
  const [expandedDetails, setExpandedDetails] = useState<Record<number, ReceiptDetail>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

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

  function openImport() {
    setStep("paste");
    setRawText("");
    setStoreId(stores[0]?.id ?? 0);
    setDate(new Date().toISOString().split("T")[0]);
    setParsedItems([]);
    setMatchedItems([]);
    setNewItemNames([]);
    setNewItemCategories([]);
    setOrderNumber("");
    setNotes("");
    setImportOpen(true);
  }

  async function handleParse() {
    if (!rawText.trim()) return;
    setParsing(true);
    try {
      const result = await parseReceipt(rawText);
      const parsed = result.items;
      setParsedItems(parsed);
      if (result.date) setDate(result.date);
      if (result.orderNumber) setOrderNumber(result.orderNumber);
      if (result.storeAddress) setNotes(result.storeAddress);
      // Auto-match by fuzzy name, stripping store brand prefixes before comparison
      const matched = parsed.map((p) => {
        const q = stripBrandPrefix(p.rawName).toLowerCase();
        const found = items.find((i) => {
          const iName = stripBrandPrefix(i.name).toLowerCase();
          return iName.includes(q) || q.includes(iName);
        });
        return found ? found.id : ("new" as const);
      });
      setMatchedItems(matched);
      setNewItemNames(parsed.map((p) => normalizeName(p.rawName)));
      setNewItemCategories(parsed.map((p) => {
        const normalized = normalizeName(p.rawName);
        const guessed = guessCategory(normalized);
        const cat = categories.find((c) => c.name === guessed) ?? categories[0];
        return cat?.id ?? 0;
      }));
      setStep("review");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    setSaving(true);
    try {
      const finalItems: Array<{
        rawName: string;
        price: number;
        quantity?: number;
        itemId?: number;
      }> = [];

      for (let i = 0; i < parsedItems.length; i++) {
        const p = parsedItems[i];
        const match = matchedItems[i];
        if (match === "skip") continue;
        if (match === "new") {
          // Create new item using the (possibly edited) normalized name
          const newItem = await createItem({
            name: newItemNames[i]?.trim() || normalizeName(p.rawName),
            categoryId: newItemCategories[i] ?? categories[0]?.id ?? 1,
          });
          finalItems.push({ rawName: p.rawName, price: p.price, quantity: p.quantity, itemId: newItem.id });
        } else {
          finalItems.push({ rawName: p.rawName, price: p.price, quantity: p.quantity, itemId: match });
        }
      }

      // Fix: parse date as local noon to avoid UTC midnight timezone shift
      const [y, m, d] = date.split("-").map(Number);
      const localDate = new Date(y, m - 1, d, 12, 0, 0);

      await importReceipt({
        storeId,
        date: localDate,
        rawText,
        orderNumber: orderNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        items: finalItems,
      });

      toast.success(`Receipt imported — ${finalItems.length} items saved`);
      setImportOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to import receipt");
    } finally {
      setSaving(false);
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
      <div className="flex justify-end">
        {stores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a store first before importing receipts.</p>
        ) : (
          <Button onClick={openImport} size="sm">
            <Upload className="h-4 w-4 mr-1" /> Import Receipt
          </Button>
        )}
      </div>

      {receipts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No receipts yet. Import your first receipt!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {receipts.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-3">
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
                      </div>
                    </button>
                    <Badge variant="secondary" className="text-xs">{r._count.items} items</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
              {expandedId === r.id && (
                <div className="border-t px-4 pb-3">
                  {loadingId === r.id ? (
                    <p className="text-sm text-muted-foreground py-3">Loading…</p>
                  ) : expandedDetails[r.id]?.items.length ? (
                    <table className="w-full text-sm mt-3">
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
                            <td className="py-1.5 text-right font-medium text-emerald-700">${ri.price.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-muted-foreground py-3">No items found.</p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === "paste" ? "Import Receipt" : `Review Items (${parsedItems.length} found)`}
            </DialogTitle>
          </DialogHeader>

          {step === "paste" ? (
            <>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Store</Label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={storeId}
                      onChange={(e) => setStoreId(Number(e.target.value))}
                    >
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Order # <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input
                      placeholder="e.g. 2000147-33985221"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Store Address / Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input
                      placeholder="e.g. 4725 W Ox Rd, Fairfax, VA"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Paste Receipt Text</Label>
                  <Textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={"WHOLE MILK          3.49\nCHICKEN BREAST      8.99\nEGGS DOZEN          2.99\n..."}
                    className="font-mono text-xs h-64 resize-none overflow-y-auto field-sizing-fixed"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                <Button onClick={handleParse} disabled={!rawText.trim() || parsing}>
                  {parsing ? "Parsing..." : "Parse Receipt →"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-2 py-2">
                <p className="text-sm text-muted-foreground">
                  Match each item to an existing item in your database, create it as new, or skip it.
                </p>
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                  {parsedItems.map((p, i) => (
                    <div key={i} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{p.rawName}</span>
                        <span className="text-sm font-semibold">${p.price.toFixed(2)}</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <select
                          className="flex-1 border rounded px-2 py-1.5 text-xs bg-background min-w-0"
                          value={matchedItems[i] ?? "new"}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMatchedItems((prev) => {
                              const next = [...prev];
                              next[i] = val === "new" ? "new" : val === "skip" ? "skip" : Number(val);
                              return next;
                            });
                          }}
                        >
                          <option value="new">+ Create new item</option>
                          <option value="skip">— Skip this item</option>
                          <optgroup label="Existing items">
                            {items.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        {matchedItems[i] === "new" && (
                          <div className="flex gap-2 w-full flex-wrap">
                            <input
                              type="text"
                              className="flex-1 border rounded px-2 py-1.5 text-xs bg-background min-w-0"
                              placeholder="Item name"
                              value={newItemNames[i] ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewItemNames((prev) => {
                                  const next = [...prev];
                                  next[i] = val;
                                  return next;
                                });
                                // Re-guess category when name changes
                                const guessed = guessCategory(val);
                                const cat = categories.find((c) => c.name === guessed);
                                if (cat) {
                                  setNewItemCategories((prev) => {
                                    const next = [...prev];
                                    next[i] = cat.id;
                                    return next;
                                  });
                                }
                              }}
                            />
                            <select
                              className="border rounded px-2 py-1.5 text-xs bg-background"
                              value={newItemCategories[i]}
                              onChange={(e) => {
                                setNewItemCategories((prev) => {
                                  const next = [...prev];
                                  next[i] = Number(e.target.value);
                                  return next;
                                });
                              }}
                            >
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("paste")}>← Back</Button>
                <Button onClick={handleImport} disabled={saving}>
                  {saving ? "Saving..." : `Import ${parsedItems.filter((_, i) => matchedItems[i] !== "skip").length} Items`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Receipt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the receipt record. Price entries saved from this receipt will remain.
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
