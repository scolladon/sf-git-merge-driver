window.BENCHMARK_DATA = {
  "lastUpdate": 1775130954729,
  "repoUrl": "https://github.com/scolladon/sf-git-merge-driver",
  "entries": {
    "Runtime Benchmark": [
      {
        "commit": {
          "author": {
            "email": "colladonsebastien@gmail.com",
            "name": "Sebastien",
            "username": "scolladon"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "ae2c3dbc5ad455b5118eb3740a80041a7c327d4d",
          "message": "feat(perf): add comprehensive performance testing infrastructure (#179)",
          "timestamp": "2026-04-02T13:53:32+02:00",
          "tree_id": "c97f5d5c1dd996ab70637bc76f6866b08faa2063",
          "url": "https://github.com/scolladon/sf-git-merge-driver/commit/ae2c3dbc5ad455b5118eb3740a80041a7c327d4d"
        },
        "date": 1775130954404,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "merge-small-no-conflict",
            "value": 317,
            "range": "±3.88%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 353,
            "range": "±1.86%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 42,
            "range": "±0.80%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 43,
            "range": "±3.65%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 10,
            "range": "±1.78%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 10,
            "range": "±2.16%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 513,
            "range": "±1.80%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 624,
            "range": "±2.27%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-small",
            "value": 698,
            "range": "±0.97%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small",
            "value": 985,
            "range": "±3.55%",
            "unit": "ops/sec"
          },
          {
            "name": "build-small",
            "value": 8043,
            "range": "±1.06%",
            "unit": "ops/sec"
          },
          {
            "name": "format-small",
            "value": 25994,
            "range": "±0.70%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-medium",
            "value": 80,
            "range": "±1.23%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium",
            "value": 113,
            "range": "±3.43%",
            "unit": "ops/sec"
          },
          {
            "name": "build-medium",
            "value": 982,
            "range": "±1.25%",
            "unit": "ops/sec"
          },
          {
            "name": "format-medium",
            "value": 3837,
            "range": "±0.19%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-large",
            "value": 18,
            "range": "±1.64%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large",
            "value": 28,
            "range": "±2.94%",
            "unit": "ops/sec"
          },
          {
            "name": "build-large",
            "value": 181,
            "range": "±5.78%",
            "unit": "ops/sec"
          },
          {
            "name": "format-large",
            "value": 964,
            "range": "±1.05%",
            "unit": "ops/sec"
          }
        ]
      }
    ]
  }
}