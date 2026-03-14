"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getSupabase } from "@/lib/supabase";
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

interface NewCustomerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NewCustomerSheet({
  open,
  onOpenChange,
  onCreated,
}: NewCustomerSheetProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setName("");
      setPhone("");
    }
    onOpenChange(isOpen);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Müşteri adı gerekli");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from("customers").insert({
        name: name.trim(),
        phone: phone.trim() || null,
      });
      if (error) throw error;

      toast.success("Müşteri eklendi");
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Müşteri eklenemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>Yeni Müşteri</SheetTitle>
          <SheetDescription>Müşteri bilgilerini girin</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pt-4">
          <div>
            <Label htmlFor="new-cust-name">Ad Soyad *</Label>
            <Input
              id="new-cust-name"
              placeholder="Müşteri adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="new-cust-phone">Telefon</Label>
            <Input
              id="new-cust-phone"
              type="tel"
              placeholder="05XX XXX XX XX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-11 w-full font-semibold"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Müşteri Ekle
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
