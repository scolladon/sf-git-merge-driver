window.BENCHMARK_DATA = {
  "lastUpdate": 1778618870334,
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
          "id": "09382b3642ad757c323e3079627ee4afec07f67b",
          "message": "chore: migrate to Vitest, upgrade deps, add mutation testing (#177)",
          "timestamp": "2026-04-03T14:57:50+02:00",
          "tree_id": "e7f63dd1fd595cc9629fe536f9012d9478ff5b97",
          "url": "https://github.com/scolladon/sf-git-merge-driver/commit/09382b3642ad757c323e3079627ee4afec07f67b"
        },
        "date": 1775221218250,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "merge-small-no-conflict",
            "value": 236,
            "range": "±3.73%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 260,
            "range": "±1.76%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 32,
            "range": "±1.51%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 33,
            "range": "±0.82%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 8,
            "range": "±0.88%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 8,
            "range": "±1.13%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 372,
            "range": "±1.72%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 424,
            "range": "±2.62%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-small",
            "value": 404,
            "range": "±0.82%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small",
            "value": 919,
            "range": "±3.80%",
            "unit": "ops/sec"
          },
          {
            "name": "build-small",
            "value": 6189,
            "range": "±0.91%",
            "unit": "ops/sec"
          },
          {
            "name": "format-small",
            "value": 28581,
            "range": "±0.43%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-medium",
            "value": 46,
            "range": "±3.42%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium",
            "value": 96,
            "range": "±6.88%",
            "unit": "ops/sec"
          },
          {
            "name": "build-medium",
            "value": 796,
            "range": "±0.88%",
            "unit": "ops/sec"
          },
          {
            "name": "format-medium",
            "value": 3858,
            "range": "±0.19%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-large",
            "value": 11,
            "range": "±7.30%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large",
            "value": 27,
            "range": "±4.55%",
            "unit": "ops/sec"
          },
          {
            "name": "build-large",
            "value": 182,
            "range": "±1.77%",
            "unit": "ops/sec"
          },
          {
            "name": "format-large",
            "value": 980,
            "range": "±0.84%",
            "unit": "ops/sec"
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
          "id": "3dd3e6815e4dfc96035f70de5038ae9f774a7371",
          "message": "fix(perf): switch to flexible-xml-parser, introduce ports & adapters architecture (#181)",
          "timestamp": "2026-04-15T20:25:58+02:00",
          "tree_id": "59e5f0f340fd851824ab5145cdd936f6aeaab60e",
          "url": "https://github.com/scolladon/sf-git-merge-driver/commit/3dd3e6815e4dfc96035f70de5038ae9f774a7371"
        },
        "date": 1776277715486,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "merge-small-no-conflict",
            "value": 450,
            "range": "±3.26%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 468,
            "range": "±2.00%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 64,
            "range": "±1.96%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 64,
            "range": "±3.37%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 16,
            "range": "±1.84%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 16,
            "range": "±1.89%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 542,
            "range": "±1.89%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 796,
            "range": "±1.90%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-small",
            "value": 833,
            "range": "±2.31%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small",
            "value": 5398,
            "range": "±3.74%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-small",
            "value": 2026,
            "range": "±2.80%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-medium",
            "value": 108,
            "range": "±1.42%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium",
            "value": 608,
            "range": "±5.16%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-medium",
            "value": 238,
            "range": "±2.82%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-large",
            "value": 29,
            "range": "±0.55%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large",
            "value": 152,
            "range": "±2.80%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-large",
            "value": 62,
            "range": "±2.31%",
            "unit": "ops/sec"
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
        "date": 1776693689685,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "node bin/merge-driver.cjs --version",
            "value": 27,
            "range": "±2.69%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-no-conflict",
            "value": 474,
            "range": "±2.69%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 497,
            "range": "±1.80%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 67,
            "range": "±2.82%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 68,
            "range": "±2.12%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 17,
            "range": "±0.80%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 18,
            "range": "±0.86%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 536,
            "range": "±1.50%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 803,
            "range": "±1.85%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-small",
            "value": 835,
            "range": "±1.58%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small",
            "value": 5453,
            "range": "±2.56%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-small",
            "value": 2340,
            "range": "±0.96%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-medium",
            "value": 112,
            "range": "±2.93%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium",
            "value": 565,
            "range": "±3.98%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-medium",
            "value": 278,
            "range": "±3.25%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-large",
            "value": 29,
            "range": "±2.52%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large",
            "value": 150,
            "range": "±3.51%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-large",
            "value": 70,
            "range": "±1.52%",
            "unit": "ops/sec"
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
        "date": 1776697655886,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "node bin/merge-driver.cjs --version",
            "value": 25,
            "range": "±2.43%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-no-conflict",
            "value": 516,
            "range": "±2.41%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 537,
            "range": "±1.70%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 71,
            "range": "±2.92%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 71,
            "range": "±2.21%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 18,
            "range": "±0.95%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 18,
            "range": "±1.70%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 578,
            "range": "±1.67%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 854,
            "range": "±2.01%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-small",
            "value": 881,
            "range": "±1.73%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small",
            "value": 5662,
            "range": "±2.41%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-small",
            "value": 2584,
            "range": "±0.94%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-medium",
            "value": 117,
            "range": "±0.69%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium",
            "value": 651,
            "range": "±2.80%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-medium",
            "value": 312,
            "range": "±1.22%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-large",
            "value": 29,
            "range": "±0.62%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large",
            "value": 159,
            "range": "±3.21%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-large",
            "value": 74,
            "range": "±1.55%",
            "unit": "ops/sec"
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
        "date": 1776761597041,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "node bin/merge-driver.cjs --version",
            "value": 27,
            "range": "±4.21%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-no-conflict",
            "value": 533,
            "range": "±2.49%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 565,
            "range": "±1.38%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 71,
            "range": "±2.02%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 72,
            "range": "±2.91%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 18,
            "range": "±1.07%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 19,
            "range": "±1.22%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 625,
            "range": "±1.21%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 880,
            "range": "±2.16%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-small",
            "value": 875,
            "range": "±1.78%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small",
            "value": 5351,
            "range": "±3.05%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-small",
            "value": 3121,
            "range": "±2.27%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-medium",
            "value": 115,
            "range": "±0.81%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium",
            "value": 623,
            "range": "±2.40%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-medium",
            "value": 392,
            "range": "±3.75%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-large",
            "value": 29,
            "range": "±0.56%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large",
            "value": 145,
            "range": "±4.05%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-large",
            "value": 93,
            "range": "±3.88%",
            "unit": "ops/sec"
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
        "date": 1776763433408,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "node bin/merge-driver.cjs --version",
            "value": 27,
            "range": "±4.21%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-no-conflict",
            "value": 533,
            "range": "±2.49%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 565,
            "range": "±1.38%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 71,
            "range": "±2.02%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 72,
            "range": "±2.91%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 18,
            "range": "±1.07%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 19,
            "range": "±1.22%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 625,
            "range": "±1.21%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 880,
            "range": "±2.16%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-small",
            "value": 875,
            "range": "±1.78%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small",
            "value": 5351,
            "range": "±3.05%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-small",
            "value": 3121,
            "range": "±2.27%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-medium",
            "value": 115,
            "range": "±0.81%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium",
            "value": 623,
            "range": "±2.40%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-medium",
            "value": 392,
            "range": "±3.75%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-large",
            "value": 29,
            "range": "±0.56%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large",
            "value": 145,
            "range": "±4.05%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-large",
            "value": 93,
            "range": "±3.88%",
            "unit": "ops/sec"
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
        "date": 1777468558263,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "node bin/merge-driver.cjs --version",
            "value": 33,
            "range": "±2.37%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-no-conflict",
            "value": 613,
            "range": "±3.00%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 653,
            "range": "±3.04%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 96,
            "range": "±1.31%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 93,
            "range": "±4.77%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 21,
            "range": "±9.13%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 24,
            "range": "±5.78%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 786,
            "range": "±1.89%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 1198,
            "range": "±1.98%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-small",
            "value": 1586,
            "range": "±1.10%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small",
            "value": 4717,
            "range": "±2.71%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-small",
            "value": 4659,
            "range": "±2.08%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-medium",
            "value": 189,
            "range": "±3.30%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium",
            "value": 502,
            "range": "±3.70%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-medium",
            "value": 603,
            "range": "±2.85%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-large",
            "value": 42,
            "range": "±0.49%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large",
            "value": 120,
            "range": "±2.32%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-large",
            "value": 148,
            "range": "±4.77%",
            "unit": "ops/sec"
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
          "id": "eb2f1acffa46dae4e3402969195732ce701fc0b6",
          "message": "fix(writer): unfold parser-shape arrays in multi-key wrappers (#192)",
          "timestamp": "2026-05-04T12:43:12+02:00",
          "tree_id": "c02c57a8096eaa36201581f69c2c559669126e72",
          "url": "https://github.com/scolladon/sf-git-merge-driver/commit/eb2f1acffa46dae4e3402969195732ce701fc0b6"
        },
        "date": 1777891545160,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "node bin/merge-driver.cjs --version",
            "value": 37,
            "range": "±2.47%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-no-conflict",
            "value": 776,
            "range": "±2.28%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 806,
            "range": "±2.21%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 107,
            "range": "±4.78%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 106,
            "range": "±4.80%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 24,
            "range": "±8.17%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 27,
            "range": "±4.08%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 810,
            "range": "±1.99%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 1245,
            "range": "±1.82%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-small",
            "value": 1684,
            "range": "±0.95%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small",
            "value": 5094,
            "range": "±2.54%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-small",
            "value": 5557,
            "range": "±1.53%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-medium",
            "value": 200,
            "range": "±2.12%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium",
            "value": 562,
            "range": "±3.12%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-medium",
            "value": 656,
            "range": "±2.69%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-large",
            "value": 45,
            "range": "±0.74%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large",
            "value": 136,
            "range": "±2.78%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-large",
            "value": 170,
            "range": "±2.31%",
            "unit": "ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "agiuliano@gmail.com",
            "name": "anthogiu",
            "username": "anthonygiuliano"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "9b23755c77e6966406b80a1c4f310ffc9294d48b",
          "message": "fix: correct key extractor for RecordType.picklistValues (#194)\n\nCo-authored-by: Sébastien Colladon <colladonsebastien@gmail.com>",
          "timestamp": "2026-05-12T09:49:03+02:00",
          "tree_id": "8b17a28c2afbb41715afd0bea88b69b71747a0ef",
          "url": "https://github.com/scolladon/sf-git-merge-driver/commit/9b23755c77e6966406b80a1c4f310ffc9294d48b"
        },
        "date": 1778572317846,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "node bin/merge-driver.cjs --version",
            "value": 34,
            "range": "±1.96%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-no-conflict",
            "value": 771,
            "range": "±2.27%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 865,
            "range": "±1.90%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 113,
            "range": "±2.47%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 119,
            "range": "±1.26%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 27,
            "range": "±4.43%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 28,
            "range": "±5.79%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 883,
            "range": "±1.61%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 1301,
            "range": "±1.97%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-small",
            "value": 1774,
            "range": "±0.73%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small",
            "value": 5073,
            "range": "±2.28%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-small",
            "value": 5711,
            "range": "±1.39%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-medium",
            "value": 202,
            "range": "±2.96%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium",
            "value": 544,
            "range": "±3.01%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-medium",
            "value": 706,
            "range": "±3.35%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-large",
            "value": 48,
            "range": "±0.31%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large",
            "value": 128,
            "range": "±3.28%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-large",
            "value": 166,
            "range": "±5.23%",
            "unit": "ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "agiuliano@gmail.com",
            "name": "anthogiu",
            "username": "anthonygiuliano"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "8c56c28efe73ad139ce5d85656b1c9e3a2ecec27",
          "message": "feat: add tabSettings and servicePresenceStatusAccesses key extractors (#196)\n\nCo-authored-by: Sébastien Colladon <colladonsebastien@gmail.com>",
          "timestamp": "2026-05-12T22:45:21+02:00",
          "tree_id": "a4d2f59743cec4a0fe01676eb4f75343389be3f0",
          "url": "https://github.com/scolladon/sf-git-merge-driver/commit/8c56c28efe73ad139ce5d85656b1c9e3a2ecec27"
        },
        "date": 1778618869949,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "node bin/merge-driver.cjs --version",
            "value": 36,
            "range": "±1.69%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-no-conflict",
            "value": 706,
            "range": "±2.82%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small-with-conflict",
            "value": 807,
            "range": "±1.95%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-no-conflict",
            "value": 108,
            "range": "±1.44%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium-with-conflict",
            "value": 105,
            "range": "±5.00%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-no-conflict",
            "value": 24,
            "range": "±12.55%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large-with-conflict",
            "value": 26,
            "range": "±6.29%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-ordered-globalvalueset",
            "value": 798,
            "range": "±1.88%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-picklist-customfield",
            "value": 1191,
            "range": "±1.99%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-small",
            "value": 1605,
            "range": "±0.95%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-small",
            "value": 4944,
            "range": "±2.12%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-small",
            "value": 4955,
            "range": "±1.27%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-medium",
            "value": 192,
            "range": "±2.80%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-medium",
            "value": 536,
            "range": "±2.45%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-medium",
            "value": 603,
            "range": "±3.00%",
            "unit": "ops/sec"
          },
          {
            "name": "parse-large",
            "value": 44,
            "range": "±1.33%",
            "unit": "ops/sec"
          },
          {
            "name": "merge-large",
            "value": 134,
            "range": "±2.65%",
            "unit": "ops/sec"
          },
          {
            "name": "serialize-large",
            "value": 157,
            "range": "±3.15%",
            "unit": "ops/sec"
          }
        ]
      }
    ]
  }
}