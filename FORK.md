# VAC fork notes

This repository tracks [`agentclientprotocol/codex-acp`](https://github.com/agentclientprotocol/codex-acp).
`main` should stay as close to upstream as possible; keep a customization here
only while upstream does not provide it, and drop it once upstream does.

## Local extensions

- **`_meta.extraModels` on `session/new`, `session/load`, and `session/resume`**:
  a client may send a `string[]` of model ids. The adapter appends the missing
  ids to the `model` config option, borrowing the current model's reasoning
  effort list. The client supplies the display name and description. Official
  Codex has no catalog entry for these ids, so whether a selected id actually
  runs is decided by Codex.
- **`prepare: npm run build`**: `dist/` is not committed, so npm needs this hook
  when installing from GitHub (`npx -y github:zouv/codex-acp#main`).

## Syncing upstream

```bash
git fetch upstream --tags
git checkout main
git rebase upstream/main    # or merge; resolve conflicts
npm install
npm run typecheck && npm test
git push origin main
```

Before rebasing away a local extension, check whether the new upstream release
already provides the same behavior; if it does, drop the local change.
