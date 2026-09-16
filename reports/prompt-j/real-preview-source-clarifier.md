# Real preview source clarification

- **Captured:** `2026-09-16T07:35:39.137Z` (`America/Mexico_City`)
- **Verified source:** the canonical analytics functions and the current running
  API's own pool were read against the same workspace database identity
  (`heliumdb/public`, PostgreSQL 16.10). The offline preview uses only the
  resulting three canonical response objects.
- **Deployed production equivalence:** **not established**. This is a verified
  workspace/API snapshot, not a claim about a separately deployed production
  environment.
- **Transaction state:** the snapshot query was read-only and returned zero
  tickets, ticket lines, cash sessions, and transaction dates. Therefore the
  offline reconciled views show the honest zero result; ticket/folio seven-digit
  drill-down examples remain unavailable and blocked.
- **Preview boundary:** the reconciled routes consume the static canonical
  snapshot without API calls. Current/proposed routes retain their existing
  fictional fixtures. No user/session/authentication or catalog-personal-data
  records are included in the preview snapshot.
