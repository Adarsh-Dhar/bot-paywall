# databooth-movement

## Cloudflare Pages deploy

- Build the project (produces the `.vercel/output` directory used by `@cloudflare/next-on-pages`):

```bash
npm run build
```

- Deploy the static output to Cloudflare Pages:

```bash
npx wrangler pages deploy .vercel/output/static --project-name databooth
```

In the Cloudflare dashboard, for your Pages project:

- Go to **Settings → Functions** and bind the D1 database variable **`DB`** to the `databooth-db` instance you created in Wrangler, matching the `binding = "DB"` value in `wrangler.toml`.

