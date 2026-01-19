# /project:ship - Verify and Deploy

Verify all changes pass checks, then commit and push to main.

## Pre-Ship Checklist

Before shipping, verify:

1. **Lint passes**
   ```bash
   npm run lint
   ```

2. **Build succeeds**
   ```bash
   npm run build
   ```

3. **No unintended changes**
   ```bash
   git status
   git diff
   ```

## Ship Process

### Standard Ship (to main)

If all checks pass and changes are safe:

```bash
# 1. Stage all changes
git add -A

# 2. Commit with role prefix
git commit -m "[role]: descriptive message"

# 3. Push to main
git push origin main
```

Role prefixes:
- `ai:` - AI conversation changes
- `integrations:` - External integration changes
- `ui:` - Frontend/UI changes
- `data:` - Database/API changes
- `analytics:` - Metrics/dashboard changes
- `qa:` - Testing/reliability changes
- `chore:` - Configuration/tooling changes

### Feature Branch Ship (for risky changes)

If changes are experimental or could break production:

```bash
# 1. Create feature branch
git checkout -b feature/description

# 2. Commit changes
git add -A
git commit -m "[role]: descriptive message"

# 3. Push feature branch
git push -u origin feature/description

# 4. Test in staging/preview

# 5. When verified, merge to main
git checkout main
git merge feature/description
git push origin main

# 6. Clean up
git branch -d feature/description
```

## When to Use Feature Branches

Use feature branches ONLY for:
- Major refactors touching 5+ files across systems
- New integrations that could fail in unexpected ways
- Database schema changes
- Changes to webhook handlers
- Anything that could break live conversations

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

# 2. Revert to it
git revert HEAD
git push origin main
```

---

## Execute Ship

Run the verification and ship process now:

1. Run `npm run lint && npm run build`
2. Review git status and diff
3. If clean, commit with appropriate prefix
4. Push to main
5. Verify Vercel deployment

**Ready to ship? Confirm the commit message to use.**
