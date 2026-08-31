# Repo Integrity Guard

This repo now includes startup and runtime guards for the frontend and backend dev servers.

These guards are implemented with PowerShell because this project is running on Windows.

## What it does

- Blocks startup when high-risk config files are already dirty in Git.
- Watches high-risk files during dev and stops the process if they change unexpectedly.
- Narrows backend `nodemon` watches to reduce restart loops from unrelated files.
- Includes the guard scripts themselves in the protected surface so tampering is easier to catch.

## Commands

- Frontend check: `npm run integrity:check`
- Frontend guarded dev: `npm run dev`
- Frontend full watch: `npm run integrity:watch`
- Backend check: `npm run integrity:check`
- Backend guarded dev: `npm run dev`
- Backend full watch: `npm run integrity:watch`

## Important limit

These guards detect and stop suspicious file drift, but they cannot fully prevent a privileged OS process or malware from writing to disk. For stronger protection, also use:

- Windows Defender or another endpoint scanner
- separate non-admin dev account
- read-only ACLs for files you are not actively editing
- `npm ci --ignore-scripts` when investigating suspicious installs
- CI that fails if build or install modifies tracked files
