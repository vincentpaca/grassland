# Deploy to riopaca.com

Grassland is served at **riopaca.com/grassland** as a static subdirectory of the main Astro site (riopaca.com repo). The Vite build uses `base: "/"`, but the app is served under `/grassland/`, so all asset paths must be patched after building.

## Prerequisites
- `aws-cli` with Amplify access
- `jq`
- The riopaca.com repo at `~/Projects/riopaca.com`

## Steps

```bash
# 1. Build
cd ~/Projects/rios_ideas/grassland
npm run build

# 2. Patch asset paths for /grassland/ subdirectory
cd dist
for f in assets/*.js index.html; do
  [ -f "$f" ] || continue
  sed -i '' \
    -e 's|src="/assets/|src="/grassland/assets/|g' \
    -e 's|"/draco/|"/grassland/draco/|g' \
    -e 's|"/player/|"/grassland/player/|g' \
    -e 's|"/pokemon3d/|"/grassland/pokemon3d/|g' \
    -e 's|=>new URL(s,location.origin).href|=>new URL(s.startsWith("assets/")?"/grassland/"+s:s,location.origin).href|g' \
    -e 's|=>new URL(a,location.origin).href|=>new URL(a.startsWith("assets/")?"/grassland/"+a:a,location.origin).href|g' \
    -e 's|function(s){return"/"+s}|function(s){return"/grassland/"+s}|g' \
    -e 's|function(e){return"/"+e}|function(e){return"/grassland/"+e}|g' \
    "$f"
done

# 3. Verify no bare paths remain
grep -rlE '"\/(draco|player|pokemon3d)\/[^g]' assets/*.js index.html
# (should output nothing)

# 4. Copy into the riopaca.com site
rm -rf ~/Projects/riopaca.com/public/grassland
cp -R dist ~/Projects/riopaca.com/public/grassland

# 5. Build and deploy the main site
cd ~/Projects/riopaca.com
npm run build
cd dist && zip -r /tmp/riopaca-deploy.zip . -x "*.DS_Store"
aws amplify create-deployment --app-id d5v8n8gds1xxt --branch-name staging --output json > /tmp/deploy.json
JOB_ID=$(jq -r .jobId /tmp/deploy.json)
UPLOAD_URL=$(jq -r .zipUploadUrl /tmp/deploy.json)
curl --upload-file /tmp/riopaca-deploy.zip "$UPLOAD_URL"
aws amplify start-deployment --app-id d5v8n8gds1xxt --branch-name staging --job-id "$JOB_ID"

# 6. Check status
aws amplify get-job --app-id d5v8n8gds1xxt --branch-name staging --job-id "$JOB_ID" --query 'job.summary.status' --output text
```

## Why path patching is needed

Vite builds with `base: "/"`, producing root-absolute paths like `/assets/foo.js`. But the app is served under `/grassland/`, so these would 404 at the domain root. Three things need patching across all JS files (not just the entry):

1. **Vite modulepreload resolver** — `function(s){return"/"+s}` → `return"/grassland/"+s`
2. **Babylon's `GetAbsoluteUrl`** — `new URL(s,location.origin)` → prepend `/grassland/` for asset paths
3. **Hardcoded asset URLs** — `/draco/`, `/player/`, `/pokemon3d/` → `/grassland/draco/`, etc.

## CDN cache

Amplify's CloudFront caches with `s-maxage=31536000` (1 year). Hashed filenames bust automatically. To force a refresh for testing, append a query string: `https://www.riopaca.com/grassland/?v=2`.
