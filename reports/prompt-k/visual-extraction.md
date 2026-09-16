# Prompt K — visual extraction

## Scope

This extraction creates an isolated `CurrentProveedores` visual reference in
`artifacts/mockup-sandbox/src/components/mockups/prompt-k-clientes/`. It copies
the four-card summary structure from the current Proveedores page only. The
main-app `Clientes` and `Proveedores` files are not modified, and no Clientes
financial behavior is implemented here.

The preview is explicitly labeled **“Referencia visual — datos de ejemplo”**.
All four values are `—` placeholders; the sandbox component has no API client,
query hook, auth context, database, session, `fetch`, or server request.

## Source provenance

| Source | Citation | SHA-256 |
| --- | --- | --- |
| `artifacts/mariana-textil/src/pages/proveedores.tsx` | `L136-L165` (four summary cards) | `acc1aa591c6e6009f491b4414e5170f6fbd53b6a260e84b250f987cff607e0e0` |
| `artifacts/mariana-textil/src/index.css` | `L81-L149` (`:root` tokens/fonts), `L151-L214` (`.dark` tokens) | `6c372e94228e7d03a78c938f83045d729aa56579d81fda7f395f58e4e82ed9a1` |
| `artifacts/mariana-textil/index.html` | `L16-L18` (Inter font links) | `7ac4cc48094660e49172ee01111ec645a1fecbbf26884e3e8930f52145104d1c` |

The extracted group keeps the source card markup and classes in the local
`_shared/SummaryCard.tsx`, uses the copied Mariana tokens in `_group.css`, and
scopes the Inter font import to this group. `src/index.css` in the sandbox is
not given the application tokens.

## Sandbox configuration

- Artifact base path: `/__mockup`
- Workflow service: `artifacts/mockup-sandbox: Component Preview Server`
- Local port: `8081`
- Dev command: `pnpm --filter @workspace/mockup-sandbox run dev`
- Preview path: `/preview/prompt-k-clientes/CurrentProveedores`
- Exact preview URL: `https://${REPLIT_DOMAINS}/__mockup/preview/prompt-k-clientes/CurrentProveedores`
- Component source: `artifacts/mockup-sandbox/src/components/mockups/prompt-k-clientes/CurrentProveedores.tsx`

Required artifact TOML service shape (the existing sandbox artifact manager owns
`.replit-artifact/artifact.toml`; apply it through its validated replacement
flow rather than editing that file directly):

```toml
kind = "design"
previewPath = "/__mockup"
title = "Canvas"
version = "1.0.0"
id = "XegfDyZt7HqfW2Bb8Ghoy"

[[services]]
localPort = 8081
name = "Component Preview Server"
paths = ["/__mockup"]

[services.env]
PORT = "8081"
BASE_PATH = "/__mockup"

[services.development]
run = "pnpm --filter @workspace/mockup-sandbox run dev"
```

The board/canvas remains untouched; the owning agent can embed the exact URL
above when the sandbox workflow is running.