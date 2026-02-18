# Smart Bookmark

Smart Bookmark is a Next.js + Supabase app to save, edit, and manage personal bookmarks with Google login.

## Features

- Google-only authentication
- Add bookmark with validation (`title` + `url`)
- Inline edit with validation
- Table view for bookmarks
- URL is clickable, title is plain text
- Realtime sync from Supabase (`INSERT`, `UPDATE`, `DELETE`)
- Delete confirmation modal
- Logout confirmation modal
- Loading states for login, add, update, delete, and logout actions

## Tech Stack

- Next.js 16
- React 19
- Supabase (Auth + Postgres + Realtime)
- Zod (form validation)
- Tailwind CSS 4

## Prerequisites

- Node.js 18+
- npm
- A Supabase project

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Supabase Setup

### 1. Enable Google Auth

In Supabase Dashboard:

1. Go to `Authentication -> Providers -> Google`
2. Enable Google provider
3. Add OAuth credentials
4. Set redirect URL to your local app (for example `http://localhost:3000`)

### 2. Create `bookmarks` table

Run this SQL in Supabase SQL Editor:

```sql
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 120),
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists bookmarks_user_id_created_at_idx
  on public.bookmarks (user_id, created_at desc);
```

### 3. Enable Row Level Security (RLS)

```sql
alter table public.bookmarks enable row level security;

create policy "bookmarks_select_own"
on public.bookmarks
for select
using (auth.uid() = user_id);

create policy "bookmarks_insert_own"
on public.bookmarks
for insert
with check (auth.uid() = user_id);

create policy "bookmarks_update_own"
on public.bookmarks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "bookmarks_delete_own"
on public.bookmarks
for delete
using (auth.uid() = user_id);
```

### 4. Enable Realtime for table

```sql
alter publication supabase_realtime add table public.bookmarks;
```

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Notes

- URL validation expects a full URL (including `http://` or `https://`).
- Do not commit `.env.local` to source control.
