This repo contains the code for Fangorn's website and docs.

## Build and Deploy

``` SH
pnpm --filter docs-fangorn-network build
npx wrangler deploy -c docs.fangorn.network/wrangler.jsonc
```
