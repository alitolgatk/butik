-- =============================================
-- Butik POS - Veritabanı Migration Scripti
-- Bu scripti Supabase Dashboard > SQL Editor'de çalıştırın
-- =============================================

-- Ürünler
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  price decimal(10,2) not null,
  has_variants boolean default false,
  stock integer default 0,
  created_at timestamptz default now()
);

-- Ürün varyantları (esnek beden sistemi)
create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  size_label text not null,
  stock integer default 0
);

-- Müşteriler
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  total_debt decimal(10,2) default 0,
  created_at timestamptz default now()
);

-- Satışlar
create table sales (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('nakit','kart','havale','acik_hesap','emanet')),
  customer_id uuid references customers(id),
  total_amount decimal(10,2) not null,
  status text default 'completed' check (status in ('completed','open')),
  notes text,
  created_at timestamptz default now()
);

-- Satış kalemleri (satış anındaki ürün anlık görüntüsü)
create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  variant_label text,
  quantity integer not null,
  unit_price decimal(10,2) not null,
  returned_quantity integer default 0
);

-- Borç ödemeleri (açık hesap müşterileri için)
create table debt_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  amount decimal(10,2) not null,
  note text,
  created_at timestamptz default now()
);

-- İndirim sütunu
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount decimal(10,2) DEFAULT 0;

-- Renk sütunu (varyantlar için opsiyonel)
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS color_label text;

-- Performans için indeksler
create index idx_sales_created_at on sales(created_at);
create index idx_sales_type on sales(type);
create index idx_sales_status on sales(status);
create index idx_sales_customer_id on sales(customer_id);
create index idx_sale_items_sale_id on sale_items(sale_id);
create index idx_product_variants_product_id on product_variants(product_id);
create index idx_debt_payments_customer_id on debt_payments(customer_id);

-- RLS (Row Level Security) devre dışı - tek kullanıcılı uygulama
alter table products enable row level security;
alter table product_variants enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table debt_payments enable row level security;

-- Herkese tam erişim politikaları (kimlik doğrulama yok)
create policy "Public access" on products for all using (true) with check (true);
create policy "Public access" on product_variants for all using (true) with check (true);
create policy "Public access" on customers for all using (true) with check (true);
create policy "Public access" on sales for all using (true) with check (true);
create policy "Public access" on sale_items for all using (true) with check (true);
create policy "Public access" on debt_payments for all using (true) with check (true);
