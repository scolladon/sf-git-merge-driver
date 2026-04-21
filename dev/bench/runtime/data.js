window.BENCHMARK_DATA = {
  "lastUpdate": 1776763434078,
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
      }
    ]
  }
}