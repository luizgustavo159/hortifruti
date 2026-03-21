/* eslint-disable no-console */
const { performance } = require("perf_hooks");

const targetUrl = process.env.LOAD_TEST_URL || "http://127.0.0.1:3000/api/health";
const durationSeconds = Number(process.env.LOAD_TEST_DURATION || 20);
const concurrency = Number(process.env.LOAD_TEST_CONNECTIONS || 20);

let totalRequests = 0;
let failedRequests = 0;
const latencies = [];
let stop = false;

const runWorker = async () => {
  while (!stop) {
    const startedAt = performance.now();
    try {
      const response = await fetch(targetUrl, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        failedRequests += 1;
      }
    } catch {
      failedRequests += 1;
    } finally {
      totalRequests += 1;
      latencies.push(performance.now() - startedAt);
    }
  }
};

const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.floor((p / 100) * (sorted.length - 1));
  return Number(sorted[index].toFixed(2));
};

(async () => {
  console.log(`Load test: ${targetUrl}`);
  console.log(`Duration: ${durationSeconds}s | Concurrency: ${concurrency}`);

  const workers = Array.from({ length: concurrency }, () => runWorker());
  await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));
  stop = true;
  await Promise.all(workers);

  const totalMs = durationSeconds * 1000;
  const rps = Number((totalRequests / durationSeconds).toFixed(2));
  const errorRate = totalRequests > 0 ? Number(((failedRequests / totalRequests) * 100).toFixed(2)) : 0;

  console.log(
    JSON.stringify(
      {
        target_url: targetUrl,
        duration_seconds: durationSeconds,
        concurrency,
        total_requests: totalRequests,
        requests_per_second: rps,
        failed_requests: failedRequests,
        error_rate_percent: errorRate,
        latency_ms: {
          p50: percentile(latencies, 50),
          p95: percentile(latencies, 95),
          p99: percentile(latencies, 99),
        },
        elapsed_ms: totalMs,
      },
      null,
      2
    )
  );

  process.exitCode = failedRequests > 0 ? 1 : 0;
})();
