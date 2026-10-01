# Annual credit pagination benchmark

Status: FAILED. Cleanup: true.

Exact legacy browser metric: annual navigation → report-content-clientes visible → two animation frames. Three fresh browser/login samples per mode; login excluded. HTTP timing is separate.

## Summary (milliseconds)

{
  "samplesCompleted": 0
}

## Limits

- Fresh local PostgreSQL and 2575 synthetic customers, not the old Neon snapshot or inherited customer histories; historical 11792ms/12355ms and rejected-index 11496ms are context only.

- SQL historical fixtures are performance workload, not native producer correctness evidence.

- OFF changes one presentation boolean in HTTP-served frozen JS; API, SQL, data, sorting, financial calculations and exports are unchanged.

- Current canonical schema preparation, not a historical schema clone. No financial indexes added by this harness.

- API timing is actual HTTP including PostgreSQL work; render remainder also includes browser/network overhead and is not pure CPU time.

- PDF verifies complete synthetic-customer identifier coverage; XLSX verifies every table row count. CSV is unsupported by this released report API.

## Failure
AssertionError [ERR_ASSERTION]: DOM rows pagos-dirigidos

2 !== 1

    at file:///home/runner/workspace/reports/credit-pagination-20261001/benchmark-main.mjs:212:14