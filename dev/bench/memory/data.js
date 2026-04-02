window.BENCHMARK_DATA = {
  "lastUpdate": 1775130955477,
  "repoUrl": "https://github.com/scolladon/sf-git-merge-driver",
  "entries": {
    "Memory Benchmark": [
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
        "date": 1775130955443,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "merge-small-no-conflict",
            "value": 3.1532,
            "range": "±3.88%",
            "unit": "ms"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 2.8344,
            "range": "±1.86%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 23.8179,
            "range": "±0.80%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 23.5068,
            "range": "±3.65%",
            "unit": "ms"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 99.2047,
            "range": "±1.78%",
            "unit": "ms"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 96.0465,
            "range": "±2.16%",
            "unit": "ms"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 1.9507,
            "range": "±1.80%",
            "unit": "ms"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 1.6031,
            "range": "±2.27%",
            "unit": "ms"
          },
          {
            "name": "parse-small",
            "value": 1.4333,
            "range": "±0.97%",
            "unit": "ms"
          },
          {
            "name": "merge-small",
            "value": 1.0156,
            "range": "±3.55%",
            "unit": "ms"
          },
          {
            "name": "build-small",
            "value": 0.1243,
            "range": "±1.06%",
            "unit": "ms"
          },
          {
            "name": "format-small",
            "value": 0.0385,
            "range": "±0.70%",
            "unit": "ms"
          },
          {
            "name": "parse-medium",
            "value": 12.4717,
            "range": "±1.23%",
            "unit": "ms"
          },
          {
            "name": "merge-medium",
            "value": 8.8744,
            "range": "±3.43%",
            "unit": "ms"
          },
          {
            "name": "build-medium",
            "value": 1.0179,
            "range": "±1.25%",
            "unit": "ms"
          },
          {
            "name": "format-medium",
            "value": 0.2606,
            "range": "±0.19%",
            "unit": "ms"
          },
          {
            "name": "parse-large",
            "value": 54.3356,
            "range": "±1.64%",
            "unit": "ms"
          },
          {
            "name": "merge-large",
            "value": 36.0243,
            "range": "±2.94%",
            "unit": "ms"
          },
          {
            "name": "build-large",
            "value": 5.5271,
            "range": "±5.78%",
            "unit": "ms"
          },
          {
            "name": "format-large",
            "value": 1.0369,
            "range": "±1.05%",
            "unit": "ms"
          }
        ]
      }
    ]
  }
}