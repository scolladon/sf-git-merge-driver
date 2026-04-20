window.BENCHMARK_DATA = {
  "lastUpdate": 1776693691437,
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
    ],
    "Latency Benchmark": [
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
          "id": "3dd3e6815e4dfc96035f70de5038ae9f774a7371",
          "message": "fix(perf): switch to flexible-xml-parser, introduce ports & adapters architecture (#181)",
          "timestamp": "2026-04-15T20:25:58+02:00",
          "tree_id": "59e5f0f340fd851824ab5145cdd936f6aeaab60e",
          "url": "https://github.com/scolladon/sf-git-merge-driver/commit/3dd3e6815e4dfc96035f70de5038ae9f774a7371"
        },
        "date": 1776277716840,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "merge-small-no-conflict",
            "value": 2.2231,
            "range": "±3.26%",
            "unit": "ms"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 2.135,
            "range": "±2.00%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 15.5424,
            "range": "±1.96%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 15.5996,
            "range": "±3.37%",
            "unit": "ms"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 61.5876,
            "range": "±1.84%",
            "unit": "ms"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 62.1388,
            "range": "±1.89%",
            "unit": "ms"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 1.8445,
            "range": "±1.89%",
            "unit": "ms"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 1.2566,
            "range": "±1.90%",
            "unit": "ms"
          },
          {
            "name": "parse-small",
            "value": 1.2006,
            "range": "±2.31%",
            "unit": "ms"
          },
          {
            "name": "merge-small",
            "value": 0.1853,
            "range": "±3.74%",
            "unit": "ms"
          },
          {
            "name": "serialize-small",
            "value": 0.4935,
            "range": "±2.80%",
            "unit": "ms"
          },
          {
            "name": "parse-medium",
            "value": 9.2192,
            "range": "±1.42%",
            "unit": "ms"
          },
          {
            "name": "merge-medium",
            "value": 1.6448,
            "range": "±5.16%",
            "unit": "ms"
          },
          {
            "name": "serialize-medium",
            "value": 4.1987,
            "range": "±2.82%",
            "unit": "ms"
          },
          {
            "name": "parse-large",
            "value": 34.8108,
            "range": "±0.55%",
            "unit": "ms"
          },
          {
            "name": "merge-large",
            "value": 6.5705,
            "range": "±2.80%",
            "unit": "ms"
          },
          {
            "name": "serialize-large",
            "value": 16.1532,
            "range": "±2.31%",
            "unit": "ms"
          }
        ]
      },
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
          "id": "ba74cfbbfa26f3ce597fc7a3453ce64fbeb1cf89",
          "message": "feat(perf): standalone binary merge driver (~7.5x faster) (#184)\n\nCo-authored-by: yohanim <kevin.gossent@gmail.com>",
          "timestamp": "2026-04-20T15:59:05+02:00",
          "tree_id": "61ea5c6e0dd005f1355304003cb90f0ccb7e583e",
          "url": "https://github.com/scolladon/sf-git-merge-driver/commit/ba74cfbbfa26f3ce597fc7a3453ce64fbeb1cf89"
        },
        "date": 1776693691384,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "node bin/merge-driver.cjs --version",
            "value": 36.7433,
            "range": "±2.69%",
            "unit": "ms"
          },
          {
            "name": "merge-small-no-conflict",
            "value": 2.1119,
            "range": "±2.69%",
            "unit": "ms"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 2.0107,
            "range": "±1.80%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 14.9479,
            "range": "±2.82%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 14.6462,
            "range": "±2.12%",
            "unit": "ms"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 57.6208,
            "range": "±0.80%",
            "unit": "ms"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 56.9574,
            "range": "±0.86%",
            "unit": "ms"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 1.8641,
            "range": "±1.50%",
            "unit": "ms"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 1.2449,
            "range": "±1.85%",
            "unit": "ms"
          },
          {
            "name": "parse-small",
            "value": 1.1969,
            "range": "±1.58%",
            "unit": "ms"
          },
          {
            "name": "merge-small",
            "value": 0.1834,
            "range": "±2.56%",
            "unit": "ms"
          },
          {
            "name": "serialize-small",
            "value": 0.4274,
            "range": "±0.96%",
            "unit": "ms"
          },
          {
            "name": "parse-medium",
            "value": 8.9478,
            "range": "±2.93%",
            "unit": "ms"
          },
          {
            "name": "merge-medium",
            "value": 1.7695,
            "range": "±3.98%",
            "unit": "ms"
          },
          {
            "name": "serialize-medium",
            "value": 3.5961,
            "range": "±3.25%",
            "unit": "ms"
          },
          {
            "name": "parse-large",
            "value": 34.9243,
            "range": "±2.52%",
            "unit": "ms"
          },
          {
            "name": "merge-large",
            "value": 6.6777,
            "range": "±3.51%",
            "unit": "ms"
          },
          {
            "name": "serialize-large",
            "value": 14.1918,
            "range": "±1.52%",
            "unit": "ms"
          }
        ]
      }
    ]
  }
}