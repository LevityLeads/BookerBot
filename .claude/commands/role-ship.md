---
description: Verify all changes pass checks, then commit and push to main
---

# /role:ship - Verify and Deploy

Verify all changes pass checks, then commit and push to main. **Never create PRs or feature branches.**

## Pre-Ship Checklist

Before shipping, verify:

1. **On main branch**
   ```bash
   git checkout main
   ```

2. **Pull latest**
   ```bash
   git pull origin main
   ```

3. **Lint passes**
   ```bash
   npm run lint
   ```

4. **Build succeeds**
   ```bash
   npm run build
   ```

5. **No unintended changes**
   ```bash
   git status
   git diff
   ```

## Ship Process

**Always push directly to main:**

```bash
# 1. Stage all changes
git add -A

# 2. Commit with role prefix
git commit -m "[role]: descriptive message"

# 3. Pull-rebase to handle parallel sessions
git pull --rebase origin main

# 4. Push to main
git push origin main
```

### Role Prefixes

- `ai:` - AI conversation changes
- `integrations:` - External integration changes
- `ui:` - Frontend/UI changes
- `data:` - Database/API changes
- `analytics:` - Metrics/dashboard changes
- `qa:` - Testing/reliability changes
- `chore:` - Configuration/tooling changes

### Handling Rebase Conflicts

If `git pull --rebase` shows conflicts:

```bash
# 1. See which files conflict
git status

# 2. Resolve conflicts in each file (remove <<<< ==== >>>> markers)

# 3. Stage resolved files
git add <resolved-file>

# 4. Continue rebase
git rebase --continue

# 5. Push to main
git push origin main
```

## Post-Ship Verification

After pushing to main:

1. **Check Vercel deployment** - Verify build succeeds
2. **Spot check in production** - Quick sanity test
3. **Monitor logs** - Watch for errors in first few minutes

## Rollback Process

If something breaks after shipping:

```bash
# 1. Find the last good commit
git log --oneline -10

# 2. Revert the bad commit
git revert HEAD
git push origin main
```

---

## Execute Ship Now

Run the full ship process:

```bash
git checkout main && \
git pull origin main && \
npm run lint && \
npm run build && \
git add -A && \
git commit -m "[role]: message" && \
git pull --rebase origin main && \
git push origin main
```

**Replace `[role]` with the appropriate prefix and provide a descriptive message.**
