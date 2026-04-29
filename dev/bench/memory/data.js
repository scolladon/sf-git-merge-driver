window.BENCHMARK_DATA = {
  "lastUpdate": 1777468559813,
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
          "id": "87491505e6cdd9447a02eaacc6dbbf73029a76d9",
          "message": "fix(install): idempotent install, --dry-run, --on-conflict handling (#186)",
          "timestamp": "2026-04-20T17:04:56+02:00",
          "tree_id": "94ca7d00f79d8be7790cd9eea5422c91b45d41e2",
          "url": "https://github.com/scolladon/sf-git-merge-driver/commit/87491505e6cdd9447a02eaacc6dbbf73029a76d9"
        },
        "date": 1776697656948,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "node bin/merge-driver.cjs --version",
            "value": 39.7485,
            "range": "±2.43%",
            "unit": "ms"
          },
          {
            "name": "merge-small-no-conflict",
            "value": 1.9373,
            "range": "±2.41%",
            "unit": "ms"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 1.8614,
            "range": "±1.70%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 14.1537,
            "range": "±2.92%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 14.0897,
            "range": "±2.21%",
            "unit": "ms"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 55.6203,
            "range": "±0.95%",
            "unit": "ms"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 55.7887,
            "range": "±1.70%",
            "unit": "ms"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 1.7291,
            "range": "±1.67%",
            "unit": "ms"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 1.1714,
            "range": "±2.01%",
            "unit": "ms"
          },
          {
            "name": "parse-small",
            "value": 1.1351,
            "range": "±1.73%",
            "unit": "ms"
          },
          {
            "name": "merge-small",
            "value": 0.1766,
            "range": "±2.41%",
            "unit": "ms"
          },
          {
            "name": "serialize-small",
            "value": 0.387,
            "range": "±0.94%",
            "unit": "ms"
          },
          {
            "name": "parse-medium",
            "value": 8.5768,
            "range": "±0.69%",
            "unit": "ms"
          },
          {
            "name": "merge-medium",
            "value": 1.5359,
            "range": "±2.80%",
            "unit": "ms"
          },
          {
            "name": "serialize-medium",
            "value": 3.2067,
            "range": "±1.22%",
            "unit": "ms"
          },
          {
            "name": "parse-large",
            "value": 34.0372,
            "range": "±0.62%",
            "unit": "ms"
          },
          {
            "name": "merge-large",
            "value": 6.2915,
            "range": "±3.21%",
            "unit": "ms"
          },
          {
            "name": "serialize-large",
            "value": 13.5275,
            "range": "±1.55%",
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
          "id": "e810eace9985c6bee4d0e5c33414741b6acae51e",
          "message": "refactor: improve code base for performance and maintenance (#187)",
          "timestamp": "2026-04-21T10:50:38+02:00",
          "tree_id": "5cbd08d045607b00372607962a710cdc7704eb67",
          "url": "https://github.com/scolladon/sf-git-merge-driver/commit/e810eace9985c6bee4d0e5c33414741b6acae51e"
        },
        "date": 1776761599071,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "node bin/merge-driver.cjs --version",
            "value": 37.4363,
            "range": "±4.21%",
            "unit": "ms"
          },
          {
            "name": "merge-small-no-conflict",
            "value": 1.8777,
            "range": "±2.49%",
            "unit": "ms"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 1.7691,
            "range": "±1.38%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 13.989,
            "range": "±2.02%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 13.9665,
            "range": "±2.91%",
            "unit": "ms"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 54.5942,
            "range": "±1.07%",
            "unit": "ms"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 54.0475,
            "range": "±1.22%",
            "unit": "ms"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 1.6,
            "range": "±1.21%",
            "unit": "ms"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 1.1366,
            "range": "±2.16%",
            "unit": "ms"
          },
          {
            "name": "parse-small",
            "value": 1.1433,
            "range": "±1.78%",
            "unit": "ms"
          },
          {
            "name": "merge-small",
            "value": 0.1869,
            "range": "±3.05%",
            "unit": "ms"
          },
          {
            "name": "serialize-small",
            "value": 0.3204,
            "range": "±2.27%",
            "unit": "ms"
          },
          {
            "name": "parse-medium",
            "value": 8.6938,
            "range": "±0.81%",
            "unit": "ms"
          },
          {
            "name": "merge-medium",
            "value": 1.6043,
            "range": "±2.40%",
            "unit": "ms"
          },
          {
            "name": "serialize-medium",
            "value": 2.553,
            "range": "±3.75%",
            "unit": "ms"
          },
          {
            "name": "parse-large",
            "value": 34.7194,
            "range": "±0.56%",
            "unit": "ms"
          },
          {
            "name": "merge-large",
            "value": 6.9184,
            "range": "±4.05%",
            "unit": "ms"
          },
          {
            "name": "serialize-large",
            "value": 10.6961,
            "range": "±3.88%",
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
          "id": "a6792f930412a8ca6ec618a85bceacb74a832108",
          "message": "fix(release): anchor release-please to existing v-prefixed tags (#188)",
          "timestamp": "2026-04-21T11:22:30+02:00",
          "tree_id": "eb03412e1d67ca2e272943b358a36ae8bdb47ab9",
          "url": "https://github.com/scolladon/sf-git-merge-driver/commit/a6792f930412a8ca6ec618a85bceacb74a832108"
        },
        "date": 1776763435323,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "node bin/merge-driver.cjs --version",
            "value": 37.4363,
            "range": "±4.21%",
            "unit": "ms"
          },
          {
            "name": "merge-small-no-conflict",
            "value": 1.8777,
            "range": "±2.49%",
            "unit": "ms"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 1.7691,
            "range": "±1.38%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 13.989,
            "range": "±2.02%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 13.9665,
            "range": "±2.91%",
            "unit": "ms"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 54.5942,
            "range": "±1.07%",
            "unit": "ms"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 54.0475,
            "range": "±1.22%",
            "unit": "ms"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 1.6,
            "range": "±1.21%",
            "unit": "ms"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 1.1366,
            "range": "±2.16%",
            "unit": "ms"
          },
          {
            "name": "parse-small",
            "value": 1.1433,
            "range": "±1.78%",
            "unit": "ms"
          },
          {
            "name": "merge-small",
            "value": 0.1869,
            "range": "±3.05%",
            "unit": "ms"
          },
          {
            "name": "serialize-small",
            "value": 0.3204,
            "range": "±2.27%",
            "unit": "ms"
          },
          {
            "name": "parse-medium",
            "value": 8.6938,
            "range": "±0.81%",
            "unit": "ms"
          },
          {
            "name": "merge-medium",
            "value": 1.6043,
            "range": "±2.40%",
            "unit": "ms"
          },
          {
            "name": "serialize-medium",
            "value": 2.553,
            "range": "±3.75%",
            "unit": "ms"
          },
          {
            "name": "parse-large",
            "value": 34.7194,
            "range": "±0.56%",
            "unit": "ms"
          },
          {
            "name": "merge-large",
            "value": 6.9184,
            "range": "±4.05%",
            "unit": "ms"
          },
          {
            "name": "serialize-large",
            "value": 10.6961,
            "range": "±3.88%",
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
          "id": "5ddb63fed21d0da03bc68dff3e31073837ce7f8d",
          "message": "feat(pipeline): streaming XML (parse + write) (#189)",
          "timestamp": "2026-04-29T15:13:04+02:00",
          "tree_id": "f38cb85753965159f8b5d43a65e8d480a3cac797",
          "url": "https://github.com/scolladon/sf-git-merge-driver/commit/5ddb63fed21d0da03bc68dff3e31073837ce7f8d"
        },
        "date": 1777468559750,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "node bin/merge-driver.cjs --version",
            "value": 30.1916,
            "range": "±2.37%",
            "unit": "ms"
          },
          {
            "name": "merge-small-no-conflict",
            "value": 1.6301,
            "range": "±3.00%",
            "unit": "ms"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 1.5326,
            "range": "±3.04%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 10.3636,
            "range": "±1.31%",
            "unit": "ms"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 10.7929,
            "range": "±4.77%",
            "unit": "ms"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 47.0772,
            "range": "±9.13%",
            "unit": "ms"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 41.6687,
            "range": "±5.78%",
            "unit": "ms"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 1.2727,
            "range": "±1.89%",
            "unit": "ms"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 0.8348,
            "range": "±1.98%",
            "unit": "ms"
          },
          {
            "name": "parse-small",
            "value": 0.6304,
            "range": "±1.10%",
            "unit": "ms"
          },
          {
            "name": "merge-small",
            "value": 0.212,
            "range": "±2.71%",
            "unit": "ms"
          },
          {
            "name": "serialize-small",
            "value": 0.2146,
            "range": "±2.08%",
            "unit": "ms"
          },
          {
            "name": "parse-medium",
            "value": 5.2995,
            "range": "±3.30%",
            "unit": "ms"
          },
          {
            "name": "merge-medium",
            "value": 1.9937,
            "range": "±3.70%",
            "unit": "ms"
          },
          {
            "name": "serialize-medium",
            "value": 1.6578,
            "range": "±2.85%",
            "unit": "ms"
          },
          {
            "name": "parse-large",
            "value": 23.7957,
            "range": "±0.49%",
            "unit": "ms"
          },
          {
            "name": "merge-large",
            "value": 8.3364,
            "range": "±2.32%",
            "unit": "ms"
          },
          {
            "name": "serialize-large",
            "value": 6.745,
            "range": "±4.77%",
            "unit": "ms"
          }
        ]
      }
    ]
  }
}