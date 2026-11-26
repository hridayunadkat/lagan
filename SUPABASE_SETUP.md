# LAGAN cloud accounts

LAGAN is ready for Supabase email/password accounts and cloud sync.

1. Create a Supabase project.
2. Run `supabase/migrations/20261126180000_level_accounts.sql` in its SQL editor.
3. Add these variables locally and to Vercel:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

4. In Supabase Authentication, add the production URL as an allowed site URL:

```text
https://dawg-app.vercel.app
```

5. Redeploy after adding the Vercel variables.

Until these variables are present, the account form explains that cloud accounts
are unavailable and keeps the fully functional demo mode accessible.
