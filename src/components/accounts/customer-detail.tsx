"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Phone,
  RotateCcw,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { getSupabase } from "@/lib/supabase";
import { formatTL, DEBT_PAYMENT_TYPE_LABELS } from "@/lib/cart";
import type { Customer, DebtPaymentType, Sale, SaleItem, DebtPayment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PaymentSheet } from "./payment-sheet";
import { ReturnSheet } from "./return-sheet";
import {
  PaymentReceiptSheet,
  type PaymentReceiptData,
} from "./payment-receipt-sheet";

interface TimelineEntry {
  id: string;
  date: Date;
  type: "purchase" | "payment";
  amount: number;
  description: string;
  saleItems?: SaleItem[];
  paymentType?: DebtPaymentType;
}

function formatDateTR(date: Date): string {
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

interface CustomerDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
  onUpdated: () => void;
}

export function CustomerDetail({
  open,
  onOpenChange,
  customerId,
  onUpdated,
}: CustomerDetailProps) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDebt, setEditDebt] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Payment sheet
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Return sheet
  const [returnOpen, setReturnOpen] = useState(false);

  // Payment receipt
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<PaymentReceiptData | null>(
    null
  );

  const fetchData = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const supabase = getSupabase();

      const [custRes, salesRes, paymentsRes] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId).single(),
        supabase
          .from("sales")
          .select("*, sale_items(*)")
          .eq("customer_id", customerId)
          .eq("type", "acik_hesap")
          .order("created_at", { ascending: false }),
        supabase
          .from("debt_payments")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
      ]);

      if (custRes.error) throw custRes.error;
      const cust = custRes.data as Customer;
      setCustomer(cust);
      setEditName(cust.name);
      setEditPhone(cust.phone ?? "");
      setEditDebt(String(cust.total_debt));

      const entries: TimelineEntry[] = [];

      const sales = (salesRes.data ?? []) as (Sale & {
        sale_items: SaleItem[];
      })[];
      for (const sale of sales) {
        entries.push({
          id: `sale-${sale.id}`,
          date: new Date(sale.created_at),
          type: "purchase",
          amount: sale.total_amount,
          description: "Alışveriş",
          saleItems: sale.sale_items,
        });
      }

      const payments = (paymentsRes.data ?? []) as DebtPayment[];
      for (const p of payments) {
        entries.push({
          id: `pay-${p.id}`,
          date: new Date(p.created_at),
          type: "payment",
          amount: p.amount,
          description: p.note || "Ödeme",
          paymentType: p.payment_type,
        });
      }

      entries.sort((a, b) => b.date.getTime() - a.date.getTime());
      setTimeline(entries);
    } catch {
      toast.error("Müşteri bilgileri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (open && customerId) {
      setEditing(false);
      setExpandedSale(null);
      fetchData();
    }
  }, [open, customerId, fetchData]);

  function handlePaymentDone(receipt: PaymentReceiptData) {
    fetchData();
    onUpdated();
    setReceiptData(receipt);
    setReceiptOpen(true);
  }

  function handleReturnDone() {
    fetchData();
    onUpdated();
  }

  function handleTimelinePaymentTap(entry: TimelineEntry) {
    if (!customer) return;
    setReceiptData({
      customerName: customer.name,
      customerPhone: customer.phone,
      date: entry.date,
      paymentType: entry.paymentType ?? "nakit",
      amount: entry.amount,
      remainingBalance: null,
      note: entry.description !== "Ödeme" ? entry.description : null,
    });
    setReceiptOpen(true);
  }

  async function handleEditSave() {
    if (!customer) return;
    if (!editName.trim()) {
      toast.error("Ad gerekli");
      return;
    }
    setEditSaving(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("customers")
        .update({
          name: editName.trim(),
          phone: editPhone.trim() || null,
          total_debt: parseFloat(editDebt) || 0,
        })
        .eq("id", customer.id);
      if (error) throw error;

      toast.success("Müşteri güncellendi");
      setEditing(false);
      fetchData();
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!customer) return;
    if (customer.total_debt !== 0) {
      toast.error(
        customer.total_debt > 0
          ? "Borcu olan müşteri silinemez"
          : "Alacağı olan müşteri silinemez"
      );
      return;
    }
    setDeleting(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customer.id);
      if (error) throw error;

      toast.success("Müşteri silindi");
      onOpenChange(false);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    } finally {
      setDeleting(false);
    }
  }

  const debtBg =
    customer && customer.total_debt > 0
      ? "bg-red-50"
      : customer && customer.total_debt < 0
        ? "bg-emerald-50"
        : "bg-muted";
  const debtTextSm =
    customer && customer.total_debt > 0
      ? "text-red-600"
      : customer && customer.total_debt < 0
        ? "text-emerald-600"
        : "text-muted-foreground";
  const debtTextLg =
    customer && customer.total_debt > 0
      ? "text-red-700"
      : customer && customer.total_debt < 0
        ? "text-emerald-700"
        : "text-foreground";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[92dvh] flex-col rounded-t-2xl"
        >
          <SheetHeader className="px-4 pt-4">
            <SheetTitle>{customer?.name ?? "Müşteri"}</SheetTitle>
            <SheetDescription className="sr-only">
              Müşteri detayları
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : customer ? (
            <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">
              {/* ---- Header info ---- */}
              {!editing ? (
                <div className="flex flex-col gap-3 pt-2">
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {customer.phone}
                    </div>
                  )}

                  {/* Debt display */}
                  <div
                    className={`rounded-xl px-4 py-3 text-center ${debtBg}`}
                  >
                    <p className={`text-xs ${debtTextSm}`}>
                      {customer.total_debt > 0
                        ? "Borç"
                        : customer.total_debt < 0
                          ? "Alacak"
                          : "Borç yok"}
                    </p>
                    <p className={`text-2xl font-bold ${debtTextLg}`}>
                      {customer.total_debt === 0
                        ? "₺0"
                        : formatTL(Math.abs(customer.total_debt))}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      {customer.total_debt > 0 && (
                        <Button
                          onClick={() => setPaymentOpen(true)}
                          className="flex-1 gap-2"
                        >
                          <Wallet className="h-4 w-4" />
                          Ödeme Al
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => setReturnOpen(true)}
                        className="flex-1 gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        İade Al
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setEditing(true)}
                      className="w-full gap-2"
                    >
                      <Pencil className="h-4 w-4" />
                      Düzenle
                    </Button>
                  </div>
                </div>
              ) : (
                /* ---- Edit mode ---- */
                <div className="flex flex-col gap-3 pt-2">
                  <div>
                    <Label htmlFor="edit-name">Ad Soyad *</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-phone">Telefon</Label>
                    <Input
                      id="edit-phone"
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-debt">Mevcut Borç (₺)</Label>
                    <Input
                      id="edit-debt"
                      type="number"
                      step="0.01"
                      value={editDebt}
                      onChange={(e) => setEditDebt(e.target.value)}
                      className="mt-1.5"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Negatif değer = müşteri alacağı
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setEditing(false);
                        setEditName(customer.name);
                        setEditPhone(customer.phone ?? "");
                        setEditDebt(String(customer.total_debt));
                      }}
                    >
                      İptal
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleEditSave}
                      disabled={editSaving}
                    >
                      {editSaving && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Kaydet
                    </Button>
                  </div>

                  {/* Delete */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="mt-2 gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={deleting}
                      >
                        {deleting && (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        )}
                        <Trash2 className="h-4 w-4" />
                        Müşteriyi Sil
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="mx-4 max-w-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Müşteriyi silmek istediğinize emin misiniz?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {customer.total_debt !== 0
                            ? customer.total_debt > 0
                              ? "Borcu olan müşteri silinemez. Önce borcu kapatın."
                              : "Alacağı olan müşteri silinemez."
                            : `"${customer.name}" kalıcı olarak silinecek.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        {customer.total_debt === 0 && (
                          <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Sil
                          </AlertDialogAction>
                        )}
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {/* ---- Timeline ---- */}
              <div className="mt-6">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  İşlem Geçmişi
                </p>

                {timeline.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Henüz işlem yok
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {timeline.map((entry) => {
                      const isPurchase = entry.type === "purchase";
                      const isExpanded = expandedSale === entry.id;

                      return (
                        <div key={entry.id}>
                          <button
                            onClick={() => {
                              if (isPurchase && entry.saleItems?.length) {
                                setExpandedSale(
                                  isExpanded ? null : entry.id
                                );
                              } else if (!isPurchase) {
                                handleTimelinePaymentTap(entry);
                              }
                            }}
                            className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors active:bg-accent"
                          >
                            <span className="text-base">
                              {isPurchase
                                ? "📦"
                                : entry.paymentType
                                  ? DEBT_PAYMENT_TYPE_LABELS[entry.paymentType]
                                      .emoji
                                  : "✅"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {isPurchase
                                  ? entry.description
                                  : entry.paymentType
                                    ? `${DEBT_PAYMENT_TYPE_LABELS[entry.paymentType].label} Tahsilat`
                                    : entry.description}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTR(entry.date)}
                                {!isPurchase &&
                                  entry.description !== "Ödeme" && (
                                    <span className="ml-1">
                                      · {entry.description}
                                    </span>
                                  )}
                              </p>
                            </div>
                            <span
                              className={`text-sm font-semibold ${
                                isPurchase
                                  ? "text-red-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {isPurchase ? "+" : "-"}
                              {formatTL(entry.amount)}
                            </span>
                            {isPurchase &&
                              entry.saleItems &&
                              entry.saleItems.length > 0 &&
                              (isExpanded ? (
                                <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                              ))}
                          </button>

                          {/* Expanded sale items */}
                          {isPurchase && isExpanded && entry.saleItems && (
                            <div className="ml-8 mt-1 flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2">
                              {entry.saleItems.map((si) => (
                                <div
                                  key={si.id}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-muted-foreground">
                                    {si.product_name}
                                    {si.variant_label &&
                                      ` (${si.variant_label})`}
                                    {" × "}
                                    {si.quantity}
                                  </span>
                                  <span className="font-medium">
                                    {formatTL(si.unit_price * si.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Payment sub-sheet */}
      {customer && (
        <PaymentSheet
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          customer={customer}
          onPaid={handlePaymentDone}
        />
      )}

      {/* Return sub-sheet */}
      {customer && (
        <ReturnSheet
          open={returnOpen}
          onOpenChange={setReturnOpen}
          customer={customer}
          onCompleted={handleReturnDone}
        />
      )}

      {/* Payment receipt */}
      <PaymentReceiptSheet
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        data={receiptData}
      />
    </>
  );
}
