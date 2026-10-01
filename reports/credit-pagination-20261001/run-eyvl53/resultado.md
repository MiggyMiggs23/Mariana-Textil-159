# Annual credit pagination benchmark

Status: COMPLETED. Cleanup: true.

Exact legacy browser metric: annual navigation → report-content-clientes visible → two animation frames. Three fresh browser/login samples per mode; login excluded. HTTP timing is separate.

## Summary (milliseconds)

{
  "on": {
    "browserMs": {
      "n": 3,
      "min": 2032.1943630000023,
      "median": 2695.7350220000008,
      "max": 3981.1559559999987
    },
    "apiMs": {
      "n": 3,
      "min": 710.493,
      "median": 745.652,
      "max": 1233.251
    }
  },
  "off": {
    "browserMs": {
      "n": 3,
      "min": 8935.679011,
      "median": 9608.869510000004,
      "max": 12141.192551
    },
    "apiMs": {
      "n": 3,
      "min": 858.41,
      "median": 914.407,
      "max": 1701.313
    }
  }
}

## Limits

- Fresh local PostgreSQL and 2575 synthetic customers, not the old Neon snapshot or inherited customer histories; historical 11792ms/12355ms and rejected-index 11496ms are context only.

- SQL historical fixtures are performance workload, not native producer correctness evidence.

- OFF changes one presentation boolean in HTTP-served frozen JS; API, SQL, data, sorting, financial calculations and exports are unchanged.

- Current canonical schema preparation, not a historical schema clone. No financial indexes added by this harness.

- API timing is actual HTTP including PostgreSQL work; render remainder also includes browser/network overhead and is not pure CPU time.

- PDF verifies complete synthetic-customer identifier coverage; XLSX verifies every table row count. CSV is unsupported by this released report API.

