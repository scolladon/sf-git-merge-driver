import { readFileSync, writeFileSync } from 'node:fs'

const runtime = JSON.parse(readFileSync('perf-runtime.json', 'utf-8'))
const memory = JSON.parse(readFileSync('perf-memory.json', 'utf-8'))

const mergeRuntime = runtime.filter(b => b.name.startsWith('merge-'))
const phaseRuntime = runtime.filter(b => !b.name.startsWith('merge-'))

const mergeMemory = memory.filter(b => b.name.startsWith('merge-'))
const phaseMemory = memory.filter(b => !b.name.startsWith('merge-'))

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>sf-git-merge-driver — Performance Benchmarks</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; }
    h1 { font-size: 1.6rem; margin-bottom: 8px; color: #58a6ff; }
    h2 { font-size: 1.2rem; margin: 32px 0 12px; color: #8b949e; border-bottom: 1px solid #21262d; padding-bottom: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .chart-box { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
    canvas { width: 100% !important; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.85rem; }
    th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #21262d; }
    th { color: #8b949e; font-weight: 600; }
    td.val { font-family: 'SF Mono', Monaco, monospace; text-align: right; }
    .subtitle { color: #8b949e; font-size: 0.9rem; margin-bottom: 24px; }
  </style>
</head>
<body>
  <h1>sf-git-merge-driver — Performance Benchmarks</h1>
  <p class="subtitle">Local run — ${new Date().toISOString().slice(0, 19)}</p>

  <div class="grid">
    <div class="chart-box">
      <h2>E2E Merge — Runtime (ops/sec, higher is better)</h2>
      <canvas id="mergeRuntime"></canvas>
    </div>
    <div class="chart-box">
      <h2>E2E Merge — Mean Time (ms, lower is better)</h2>
      <canvas id="mergeMemory"></canvas>
    </div>
  </div>

  <div class="grid">
    <div class="chart-box">
      <h2>Per-Phase — Runtime (ops/sec)</h2>
      <canvas id="phaseRuntime"></canvas>
    </div>
    <div class="chart-box">
      <h2>Per-Phase — Mean Time (ms)</h2>
      <canvas id="phaseMemory"></canvas>
    </div>
  </div>

  <h2>Raw Data</h2>
  <div class="grid">
    <div class="chart-box">
      <h2>E2E Merge Benchmarks</h2>
      <table>
        <tr><th>Benchmark</th><th>ops/sec</th><th>Mean (ms)</th><th>Range</th></tr>
        ${mergeRuntime.map((r, i) => `<tr><td>${r.name}</td><td class="val">${r.value.toLocaleString()}</td><td class="val">${mergeMemory[i].value}</td><td class="val">${r.range}</td></tr>`).join('\n        ')}
      </table>
    </div>
    <div class="chart-box">
      <h2>Per-Phase Benchmarks</h2>
      <table>
        <tr><th>Benchmark</th><th>ops/sec</th><th>Mean (ms)</th><th>Range</th></tr>
        ${phaseRuntime.map((r, i) => `<tr><td>${r.name}</td><td class="val">${r.value.toLocaleString()}</td><td class="val">${phaseMemory[i].value}</td><td class="val">${r.range}</td></tr>`).join('\n        ')}
      </table>
    </div>
  </div>

  <script>
    const colors = [
      '#58a6ff','#3fb950','#d29922','#f85149','#bc8cff',
      '#79c0ff','#56d364','#e3b341','#ff7b72','#d2a8ff',
      '#39d353','#db6d28','#a5d6ff','#ffa657','#ff9bce',
      '#7ee787','#f0883e','#6cb6ff','#d186eb','#ea6045'
    ];
    const chartOpts = (type) => ({
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { type: type === 'log' ? 'logarithmic' : 'linear', grid: { color: '#21262d' }, ticks: { color: '#8b949e' } },
        y: { grid: { display: false }, ticks: { color: '#c9d1d9', font: { size: 11 } } }
      }
    });
    const bar = (id, labels, values, type) => {
      new Chart(document.getElementById(id), {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: labels.map((_, i) => colors[i % colors.length]), borderRadius: 4 }] },
        options: chartOpts(type)
      });
    };

    bar('mergeRuntime', ${JSON.stringify(mergeRuntime.map(b => b.name))}, ${JSON.stringify(mergeRuntime.map(b => b.value))}, 'log');
    bar('mergeMemory',  ${JSON.stringify(mergeMemory.map(b => b.name))},  ${JSON.stringify(mergeMemory.map(b => b.value))}, 'log');
    bar('phaseRuntime', ${JSON.stringify(phaseRuntime.map(b => b.name))}, ${JSON.stringify(phaseRuntime.map(b => b.value))}, 'log');
    bar('phaseMemory',  ${JSON.stringify(phaseMemory.map(b => b.name))},  ${JSON.stringify(phaseMemory.map(b => b.value))}, 'log');
  </script>
</body>
</html>`

const outPath = 'perf-preview.html'
writeFileSync(outPath, html)
// biome-ignore lint/suspicious/noConsole: preview output
console.info(`Preview written to ${outPath}`)
