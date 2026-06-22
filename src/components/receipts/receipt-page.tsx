"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { FileText, Upload, Trash2, ChevronDown, ChevronUp, Check, MapPin, ExternalLink, BarChart2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { parseReceipt, importReceipt, deleteReceipt, getReceipt, updateReceipt } from "@/actions/receipts";
import { lookupCostcoItem, type CostcoItemInfo } from "@/actions/lookup";
import { createItem, updateItem } from "@/actions/items";
import { stripBrandPrefix, normalizeName, guessCategory, findSimilarItems } from "@/lib/brand-utils";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Store = { id: number; name: string };
type Category = { id: number; name: string; _count: { items: number } };
type Item = {
  id: number;
  name: string;
  category: { id: number; name: string };
};

type ParsedItem = { rawName: string; price: number; quantity?: number; externalId?: string; originalPrice?: number };

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
  const [addressLine1, setAddressLine1] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [notes, setNotes] = useState("");
  const [parsed, setParsed] = useState(false);
  const [lookupCache, setLookupCache] = useState<Record<string, CostcoItemInfo | null>>({});
  const [lookingUp, setLookingUp] = useState<Record<number, boolean>>({});
  // Extra data from WarehouseRunner per item index: unit, size, imageUrl
  const [lookupExtras, setLookupExtras] = useState<Record<number, { unit?: string; size?: number; imageUrl?: string }>>({});
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
    setAddressLine1("");
    setAddressCity("");
    setAddressState("");
    setAddressZip("");
    setNotes("");
    setParsed(false);
    setLookupCache({});
    setLookingUp({});
    setLookupExtras({});
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
      if (result.addressLine1) setAddressLine1(result.addressLine1);
      if (result.addressCity) setAddressCity(result.addressCity);
      if (result.addressState) setAddressState(result.addressState);
      if (result.addressZip) setAddressZip(result.addressZip);
      setParsed(true);
      // Auto-match by fuzzy name
      const matched = parsed.map((p) => {
        const q = stripBrandPrefix(p.rawName).toLowerCase();
        const found = items.find((i) => {
          const iName = stripBrandPrefix(i.name).toLowerCase();
          return iName.includes(q) || q.includes(iName);
        });
        return found ? found.id : ("new" as const);
      });
      setMatchedItems(matched);
      const initialNames = parsed.map((p) => normalizeName(p.rawName));
      const initialCats = parsed.map((p) => {
        const normalized = normalizeName(p.rawName);
        const guessed = guessCategory(normalized);
        const cat = categories.find((c) => c.name === guessed) ?? categories[0];
        return cat?.id ?? 0;
      });
      setNewItemNames(initialNames);
      setNewItemCategories(initialCats);
      // Kick off auto-lookups (don't await — runs in background while user edits)
      runAutoLookups(parsed, initialNames, initialCats);
    } finally {
      setParsing(false);
    }
  }

  function handleGoToReview() {
    const matched = parsedItems.map((p) => {
      const q = stripBrandPrefix(p.rawName).toLowerCase();
      const found = items.find((i) => {
        const iName = stripBrandPrefix(i.name).toLowerCase();
        return iName.includes(q) || q.includes(iName);
      });
      return found ? found.id : ("new" as const);
    });
    setMatchedItems(matched);
    setStep("review");
  }

  // Called after parse — fires all Costco lookups in parallel and applies results
  async function runAutoLookups(parsed: ParsedItem[], initialNames: string[], initialCats: number[]) {
    const toFetch = parsed
      .map((p, i) => ({ i, externalId: p.externalId }))
      .filter((x): x is { i: number; externalId: string } => !!x.externalId);

    if (toFetch.length === 0) return;

    // Mark all as loading
    const loadingMap: Record<number, boolean> = {};
    toFetch.forEach(({ i }) => { loadingMap[i] = true; });
    setLookingUp(loadingMap);

    const results = await Promise.allSettled(
      toFetch.map(({ externalId }) => lookupCostcoItem(externalId))
    );

    const newNames = [...initialNames];
    const newCats = [...initialCats];
    const newCache: Record<string, CostcoItemInfo | null> = {};
    const newExtras: Record<number, { unit?: string; size?: number; imageUrl?: string }> = {};

    results.forEach((result, idx) => {
      const { i, externalId } = toFetch[idx];
      const info = result.status === "fulfilled" ? result.value : null;
      newCache[externalId] = info;
      if (info) {
        newNames[i] = info.name;
        const warehouseCat = info.category?.toLowerCase() ?? "";
        const guessed = guessCategory(info.name) ||
          categories.find((c) => warehouseCat.includes(c.name.toLowerCase()))?.name;
        const cat = categories.find((c) => c.name === guessed) ?? categories[0];
        if (cat) newCats[i] = cat.id;
        // Parse unit/size from name: e.g. "32 oz", "24 ct", "4.7 lb"
        const sizeMatch = info.name.match(/,?\s*(\d+(?:\.\d+)?)\s*(oz|fl\s*oz|lb|ct|count|pk|pack)\b/i);
        if (sizeMatch) {
          newExtras[i] = {
            unit: sizeMatch[2].replace(/\s+/g, " ").toLowerCase().replace("fl oz", "fl oz"),
            size: parseFloat(sizeMatch[1]),
            imageUrl: info.imageUrl,
          };
        } else if (info.imageUrl) {
          newExtras[i] = { imageUrl: info.imageUrl };
        }
      }
    });

    setLookupCache(newCache);
    setNewItemNames(newNames);
    setNewItemCategories(newCats);
    setLookupExtras(newExtras);
    setLookingUp({});
  }

  async function handleImport() {
    setSaving(true);
    try {
      const finalItems: Array<{
        rawName: string;
        price: number;
        quantity?: number;
        itemId?: number;
        externalId?: string;
        originalPrice?: number;
      }> = [];

      for (let i = 0; i < parsedItems.length; i++) {
        const p = parsedItems[i];
        const match = matchedItems[i];
        if (match === "skip") continue;
        if (match === "new") {
          const extras = lookupExtras[i] ?? {};
          const newItem = await createItem({
            name: newItemNames[i]?.trim() || normalizeName(p.rawName),
            categoryId: newItemCategories[i] || categories[0]?.id || 1,
            unit: extras.unit,
            size: extras.size,
            imageUrl: extras.imageUrl,
          });
          finalItems.push({ rawName: p.rawName, price: p.price, quantity: p.quantity, itemId: newItem.id, externalId: p.externalId, originalPrice: p.originalPrice });
        } else {
          // If we have a lookup result, update the existing item's name/image/size
          if (p.externalId && lookupCache[p.externalId]) {
            const extras = lookupExtras[i] ?? {};
            const lookupName = newItemNames[i]?.trim();
            await updateItem(match, {
              ...(lookupName ? { name: lookupName } : {}),
              ...(extras.unit ? { unit: extras.unit } : {}),
              ...(extras.size != null ? { size: extras.size } : {}),
              ...(extras.imageUrl ? { imageUrl: extras.imageUrl } : {}),
            });
          }
          finalItems.push({ rawName: p.rawName, price: p.price, quantity: p.quantity, itemId: match, externalId: p.externalId, originalPrice: p.originalPrice });
        }
      }

      const [y, m, d] = date.split("-").map(Number);
      const localDate = new Date(y, m - 1, d, 12, 0, 0);

      await importReceipt({
        storeId,
        date: localDate,
        rawText,
        orderNumber: orderNumber.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        addressCity: addressCity.trim() || undefined,
        addressState: addressState.trim() || undefined,
        addressZip: addressZip.trim() || undefined,
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
      <div className="flex items-center justify-between gap-2">
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowSpend((v) => !v)}
        >
          <BarChart2 className="h-4 w-4" />
          {showSpend ? "Hide Spending" : "Show Spending"}
          {showSpend ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {stores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a store first before importing receipts.</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add at least one category first before importing receipts.</p>
        ) : (
          <Button onClick={openImport} size="sm">
            <Upload className="h-4 w-4 mr-1" /> Import Receipt
          </Button>
        )}
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
                          {addrStr && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{addrStr}</span>
                            </div>
                          )}
                        </div>
                      </button>
                      <Badge variant="secondary" className="text-xs">{r._count.items} items</Badge>
                      <Badge variant="outline" className="text-xs text-emerald-700">${r.items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0).toFixed(2)}</Badge>
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
            );
          })}
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <div className="flex flex-col max-h-[90vh]">
          <DialogHeader className="px-4 pt-4 pb-0 flex-shrink-0">
            <DialogTitle>
              {step === "paste" ? "Import Receipt" : `Review Items (${parsedItems.length} found)`}
            </DialogTitle>
          </DialogHeader>

          {step === "paste" ? (
            <>
              <div className="space-y-5 px-4 py-4 overflow-y-auto flex-1 min-h-0">
                {/* Store selector — pill buttons */}
                <div className="space-y-2">
                  <Label>Store</Label>
                  <div className="flex flex-wrap gap-2">
                    {stores.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStoreId(s.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors",
                          storeId === s.id
                            ? "bg-emerald-700 text-white border-emerald-700"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        )}
                      >
                        {storeId === s.id && <Check className="h-3.5 w-3.5" />}
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paste area */}
                <div className="space-y-1.5">
                  <Label>Paste Receipt Text</Label>
                  <Textarea
                    value={rawText}
                    onChange={(e) => { setRawText(e.target.value); setParsed(false); }}
                    placeholder={"WHOLE MILK          3.49\nCHICKEN BREAST      8.99\nEGGS DOZEN          2.99\n..."}
                    className="font-mono text-xs h-48 resize-none overflow-y-auto field-sizing-fixed"
                  />
                </div>

                {/* Auto-filled fields (shown once parsed) */}
                {parsed && (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Auto-filled from receipt — edit if needed</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Date</Label>
                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Order #</Label>
                        <Input
                          placeholder="Optional"
                          value={orderNumber}
                          onChange={(e) => setOrderNumber(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Street Address</Label>
                      <Input
                        placeholder="e.g. 4725 W Ox Rd"
                        value={addressLine1}
                        onChange={(e) => setAddressLine1(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      <div className="col-span-3 space-y-1.5">
                        <Label className="text-xs">City</Label>
                        <Input placeholder="Fairfax" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="col-span-1 space-y-1.5">
                        <Label className="text-xs">State</Label>
                        <Input placeholder="VA" value={addressState} onChange={(e) => setAddressState(e.target.value)} className="h-8 text-sm" maxLength={2} />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs">ZIP</Label>
                        <Input placeholder="22030" value={addressZip} onChange={(e) => setAddressZip(e.target.value)} className="h-8 text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
                      <Input placeholder="Any extra notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="flex-shrink-0 px-4 py-3 border-t">
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                {!parsed ? (
                  <Button onClick={handleParse} disabled={!rawText.trim() || parsing}>
                    {parsing ? "Parsing..." : "Parse Receipt →"}
                  </Button>
                ) : (
                  <Button onClick={handleGoToReview} disabled={parsedItems.length === 0}>
                    Review {parsedItems.length} Items →
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <p className="text-sm text-muted-foreground px-4 py-3 flex-shrink-0">
                  Match each item to an existing item in your database, create it as new, or skip it.
                </p>
                <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0 px-4 pb-4">
                  {parsedItems.map((p, i) => (
                    <div key={i} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm truncate">{p.rawName}</span>
                          {p.externalId && (
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                              #{p.externalId}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {p.externalId && (
                            <span className={cn(
                              "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded",
                              lookingUp[i]
                                ? "text-muted-foreground"
                                : lookupCache[p.externalId]
                                  ? "text-green-600"
                                  : "text-amber-500"
                            )}>
                              {lookingUp[i] ? (
                                <>
                                  <span className="animate-spin inline-block h-3 w-3 border border-current border-t-transparent rounded-full" />
                                  Looking up…
                                </>
                              ) : lookupCache[p.externalId] ? (
                                <><Check className="h-3 w-3" /> Found</>
                              ) : (
                                "Not found"
                              )}
                            </span>
                          )}
                          {p.externalId && (
                            <a
                              href={`https://app.warehouserunner.com/costco/${p.externalId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground p-1"
                              title="View on WarehouseRunner"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <span className="text-sm font-semibold text-emerald-700">${p.price.toFixed(2)}</span>
                          {p.originalPrice && (
                            <span className="text-xs text-muted-foreground line-through">${p.originalPrice.toFixed(2)}</span>
                          )}
                        </div>
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
                            {/* Duplicate detection */}
                            {(() => {
                              const currentName = newItemNames[i] ?? normalizeName(p.rawName);
                              const similar = findSimilarItems(currentName, items);
                              if (!similar.length) return null;
                              return (
                                <div className="w-full flex flex-wrap gap-1.5 items-center">
                                  <span className="text-xs text-amber-600 font-medium">Similar:</span>
                                  {similar.map((s) => (
                                    <button
                                      key={s.id}
                                      type="button"
                                      className="text-xs border border-amber-400 bg-amber-50 text-amber-700 rounded px-2 py-0.5 hover:bg-amber-100 transition-colors"
                                      onClick={() => setMatchedItems((prev) => {
                                        const next = [...prev];
                                        next[i] = s.id;
                                        return next;
                                      })}
                                    >
                                      Use &ldquo;{s.name}&rdquo;
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter className="flex gap-2 flex-shrink-0 px-4 py-3 border-t">
                <Button variant="outline" onClick={() => setStep("paste")}>← Back</Button>
                <Button onClick={handleImport} disabled={saving}>
                  {saving ? "Saving..." : `Import ${parsedItems.filter((_, i) => matchedItems[i] !== "skip").length} Items`}
                </Button>
              </DialogFooter>
            </>
          )}
          </div>{/* end flex flex-col wrapper */}
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
