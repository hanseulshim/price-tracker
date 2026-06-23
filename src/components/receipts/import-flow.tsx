"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ExternalLink, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { parseReceipt, importReceipt } from "@/actions/receipts";
import { lookupCostcoItem, type CostcoItemInfo } from "@/actions/lookup";
import { createItems, updateItem } from "@/actions/items";
import { stripBrandPrefix, normalizeName, guessCategory, findSimilarItems } from "@/lib/brand-utils";
import { cn } from "@/lib/utils";

type Store = { id: number; name: string };
type Category = { id: number; name: string; _count: { items: number } };
type Item = { id: number; name: string; category: { id: number; name: string } };
type ParsedItem = { rawName: string; price: number; quantity?: number; externalId?: string; originalPrice?: number };

export function ImportFlow({
  stores,
  categories,
  items,
}: {
  stores: Store[];
  categories: Category[];
  items: Item[];
}) {
  const router = useRouter();

  const [step, setStep] = useState<"paste" | "review">("paste");
  const [rawText, setRawText] = useState("");
  const [storeId, setStoreId] = useState<number>(stores[0]?.id ?? 0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [orderNumber, setOrderNumber] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [notes, setNotes] = useState("");
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [matchedItems, setMatchedItems] = useState<(number | "new" | "skip")[]>([]);
  const [newItemNames, setNewItemNames] = useState<string[]>([]);
  const [newItemCategories, setNewItemCategories] = useState<number[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [lookupCache, setLookupCache] = useState<Record<string, CostcoItemInfo | null>>({});
  const [lookingUp, setLookingUp] = useState<Record<number, boolean>>({});
  const [lookupExtras, setLookupExtras] = useState<Record<number, { unit?: string; size?: number; imageUrl?: string }>>({});

  function runAutoLookups(parsed: ParsedItem[], initialNames: string[], initialCats: number[]) {
    const toFetch = parsed
      .map((p, i) => ({ i, externalId: p.externalId }))
      .filter((x): x is { i: number; externalId: string } => !!x.externalId);

    if (toFetch.length === 0) return;

    const loadingMap: Record<number, boolean> = {};
    toFetch.forEach(({ i }) => { loadingMap[i] = true; });
    setLookingUp(loadingMap);

    let failCount = 0;
    let doneCount = 0;
    const total = toFetch.length;

    toFetch.forEach(({ i, externalId }) => {
      lookupCostcoItem(externalId).then((info) => {
        if (!info) failCount++;
        setLookupCache((prev) => ({ ...prev, [externalId]: info }));
        if (info) {
          setNewItemNames((prev) => {
            const next = [...prev];
            next[i] = info.name;
            return next;
          });
          setNewItemCategories((prev) => {
            const next = [...prev];
            const warehouseCat = info.category?.toLowerCase() ?? "";
            const guessed = guessCategory(info.name) ||
              categories.find((c) => warehouseCat.includes(c.name.toLowerCase()))?.name;
            const cat = categories.find((c) => c.name === guessed) ?? categories[0];
            if (cat) next[i] = cat.id;
            return next;
          });
          const sizeMatch = info.name.match(/,?\s*(\d+(?:\.\d+)?)\s*(oz|fl\s*oz|lb|ct|count|pk|pack)\b/i);
          setLookupExtras((prev) => ({
            ...prev,
            [i]: sizeMatch
              ? { unit: sizeMatch[2].replace(/\s+/g, " ").toLowerCase(), size: parseFloat(sizeMatch[1]), imageUrl: info.imageUrl }
              : info.imageUrl ? { imageUrl: info.imageUrl } : prev[i],
          }));
        }
      }).catch(() => {
        failCount++;
      }).finally(() => {
        doneCount++;
        setLookingUp((prev) => {
          const next = { ...prev };
          delete next[i];
          return next;
        });
        if (doneCount === total && failCount > 0) {
          toast.warning(`${failCount} item lookup${failCount > 1 ? "s" : ""} failed — check your connection`);
        }
      });
    });
  }

  async function handleParse() {
    if (!rawText.trim()) return;
    setParsing(true);
    try {
      const result = await parseReceipt(rawText);
      const parsedResult = result.items;
      setParsedItems(parsedResult);
      if (result.date) setDate(result.date);
      if (result.orderNumber) setOrderNumber(result.orderNumber);
      if (result.addressLine1) setAddressLine1(result.addressLine1);
      if (result.addressCity) setAddressCity(result.addressCity);
      if (result.addressState) setAddressState(result.addressState);
      if (result.addressZip) setAddressZip(result.addressZip);
      setParsed(true);
      const matched = parsedResult.map((p) => {
        const q = stripBrandPrefix(p.rawName).toLowerCase();
        const found = items.find((i) => {
          const iName = stripBrandPrefix(i.name).toLowerCase();
          return iName.includes(q) || q.includes(iName);
        });
        return found ? found.id : ("new" as const);
      });
      setMatchedItems(matched);
      const initialNames = parsedResult.map((p) => normalizeName(p.rawName));
      const initialCats = parsedResult.map((p) => {
        const normalized = normalizeName(p.rawName);
        const guessed = guessCategory(normalized);
        const cat = categories.find((c) => c.name === guessed) ?? categories[0];
        return cat?.id ?? 0;
      });
      setNewItemNames(initialNames);
      setNewItemCategories(initialCats);
      runAutoLookups(parsedResult, initialNames, initialCats);
    } finally {
      setParsing(false);
    }
  }

  function handleGoToReview() {
    setStep("review");
  }

  async function handleImport() {
    if (!storeId) { toast.error("Please select a store"); return; }
    setSaving(true);
    try {
      const toCreate: Array<{ idx: number; name: string; categoryId: number; unit?: string; size?: number; imageUrl?: string }> = [];
      const toUpdate: Array<{ id: number; data: Parameters<typeof updateItem>[1] }> = [];
      const existingMatches: Array<{ idx: number; itemId: number }> = [];

      for (let i = 0; i < parsedItems.length; i++) {
        const p = parsedItems[i];
        const match = matchedItems[i];
        if (match === "skip") continue;
        if (match === "new") {
          const extras = lookupExtras[i] ?? {};
          toCreate.push({
            idx: i,
            name: newItemNames[i]?.trim() || normalizeName(p.rawName),
            categoryId: newItemCategories[i] || categories[0]?.id || 1,
            unit: extras.unit,
            size: extras.size,
            imageUrl: extras.imageUrl,
          });
        } else {
          if (p.externalId && lookupCache[p.externalId]) {
            const extras = lookupExtras[i] ?? {};
            const lookupName = newItemNames[i]?.trim();
            toUpdate.push({ id: match, data: {
              ...(lookupName ? { name: lookupName } : {}),
              ...(extras.unit ? { unit: extras.unit } : {}),
              ...(extras.size != null ? { size: extras.size } : {}),
              ...(extras.imageUrl ? { imageUrl: extras.imageUrl } : {}),
            }});
          }
          existingMatches.push({ idx: i, itemId: match });
        }
      }

      const [createdItems] = await Promise.all([
        toCreate.length > 0
          ? createItems(toCreate.map(({ name, categoryId, unit, size, imageUrl }) => ({ name, categoryId, unit, size, imageUrl })))
          : Promise.resolve([]),
        ...toUpdate.map(({ id, data }) => updateItem(id, data)),
      ]);

      const finalItems: Array<{
        rawName: string; price: number; quantity?: number;
        itemId?: number; externalId?: string; originalPrice?: number;
      }> = [];

      toCreate.forEach(({ idx }, i) => {
        const p = parsedItems[idx];
        finalItems.push({ rawName: p.rawName, price: p.price, quantity: p.quantity, itemId: createdItems[i]?.id, externalId: p.externalId, originalPrice: p.originalPrice });
      });
      existingMatches.forEach(({ idx, itemId }) => {
        const p = parsedItems[idx];
        finalItems.push({ rawName: p.rawName, price: p.price, quantity: p.quantity, itemId, externalId: p.externalId, originalPrice: p.originalPrice });
      });

      if (finalItems.length === 0) {
        toast.error("No items to import — all items were skipped");
        setSaving(false);
        return;
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
      router.push("/receipts");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import receipt");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = parsedItems.filter((_, i) => matchedItems[i] !== "skip").length;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className={cn("font-medium", step === "paste" ? "text-foreground" : "text-muted-foreground")}>
          1. Paste Receipt
        </span>
        <span className="text-muted-foreground">/</span>
        <span className={cn("font-medium", step === "review" ? "text-foreground" : "text-muted-foreground")}>
          2. Review Items {step === "review" && parsedItems.length > 0 && `(${parsedItems.length} found)`}
        </span>
      </div>

      {step === "paste" ? (
        <Card>
          <CardContent className="space-y-6 pt-6">
            {/* Store selector */}
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
                        ? "bg-primary text-primary-foreground border-primary"
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
                className="font-mono text-xs h-56 resize-none"
              />
            </div>

            {/* Auto-filled fields after parse */}
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
                    <Input placeholder="Optional" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Street Address</Label>
                  <Input placeholder="e.g. 4725 W Ox Rd" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="h-8 text-sm" />
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

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => router.push("/receipts")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Cancel
              </Button>
              {!parsed ? (
                <Button onClick={handleParse} disabled={!rawText.trim() || parsing}>
                  {parsing ? "Parsing..." : "Parse Receipt →"}
                </Button>
              ) : (
                <Button onClick={handleGoToReview} disabled={parsedItems.length === 0}>
                  Review {parsedItems.length} Items →
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Match each item to an existing entry, create it as new, or skip it.
            </p>
            <div className="space-y-2">
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
                              ? "text-primary"
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
                      <span className="text-sm font-semibold text-foreground">${p.price.toFixed(2)}</span>
                      {p.originalPrice && (
                        <span className="text-xs text-muted-foreground line-through">${p.originalPrice.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <select
                      className="flex-1 border rounded px-2 py-1.5 text-xs bg-background text-foreground min-w-0"
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
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </optgroup>
                    </select>
                    {matchedItems[i] === "new" && (
                      <div className="flex gap-2 w-full flex-wrap">
                        <input
                          type="text"
                          className="flex-1 border rounded px-2 py-1.5 text-xs bg-background text-foreground min-w-0"
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
                          className="border rounded px-2 py-1.5 text-xs bg-background text-foreground"
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
                        {(() => {
                          const currentName = newItemNames[i] ?? normalizeName(p.rawName);
                          const similar = findSimilarItems(currentName, items);
                          if (!similar.length) return null;
                          return (
                            <div className="w-full flex flex-wrap gap-1.5 items-center">
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Similar:</span>
                              {similar.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  className="text-xs border border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded px-2 py-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
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

            <div className="flex justify-between pt-2 border-t">
              <Button variant="outline" onClick={() => setStep("paste")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleImport} disabled={saving || activeCount === 0}>
                {saving ? "Saving..." : `Import ${activeCount} Items`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
