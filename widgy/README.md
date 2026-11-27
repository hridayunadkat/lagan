# LAGAN in Widgy

The `/api/widget` endpoint returns the signed-in owner's existing LAGAN data
without putting a Supabase password or service-role key in Widgy.

## Configure Vercel

Add these server-only environment variables to the LAGAN Vercel project:

```text
SUPABASE_URL=https://fmdqywvgdswboxvmtnti.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Supabase project service_role key>
WIDGET_USER_ID=<the Supabase Auth user UUID>
WIDGET_TOKEN=<a long random secret>
WIDGET_TIME_ZONE=America/New_York
```

Generate the widget token with:

```bash
openssl rand -hex 32
```

Do not prefix the service-role key or widget token with `VITE_`; that would
expose them in the website bundle. Redeploy after adding the variables.

Test the deployed endpoint:

```bash
curl -H "Authorization: Bearer YOUR_WIDGET_TOKEN" \
  https://dawg-app.vercel.app/api/widget
```

It returns:

```json
{
  "date": "2026-11-26",
  "progress": 50,
  "completed": 2,
  "total": 4,
  "streak": 3,
  "habits": [
    { "name": "Exercise", "progress": 50, "complete": false }
  ],
  "generatedAt": "2026-11-26T23:45:00.000Z"
}
```

## Configure Widgy

Create text layers backed by **Async JavaScript**. Paste
[`LaganData.js`](./LaganData.js) into each layer, replace the token, and set
`FIELD` to one of:

- `progress` for `50%`
- `count` for `2/4`
- `streak` for `🔥 3`
- `habits` for up to three incomplete habit names

The token grants read-only access to this widget summary. Keep it private. If
it is shared accidentally, replace `WIDGET_TOKEN` in Vercel and redeploy.
