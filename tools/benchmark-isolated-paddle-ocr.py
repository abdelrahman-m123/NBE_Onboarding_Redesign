"""Benchmark PaddleOCR in an isolated worker process.

The script sends image jobs directly to server/identity-verification/ocr/
paddle_ocr_worker.py and samples CPU/RAM for that worker process tree only.
It does not call the HTTP API and it does not store extracted OCR text.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
import threading
import time
from typing import Any

import psutil


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "ocr-isolated-benchmark"
WORKER = ROOT / "server" / "identity-verification" / "ocr" / "paddle_ocr_worker.py"


def round_number(value: float, digits: int = 3) -> float:
    return round(value, digits)


def percentile(values: list[float], percentile_value: float) -> float:
    if not values:
        return 0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int((percentile_value / 100) * len(ordered) + 0.999999) - 1))
    return ordered[index]


def load_fixtures(fixtures_dir: Path) -> list[Path]:
    image_files = sorted(
        file
        for file in fixtures_dir.iterdir()
        if file.is_file() and file.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
    )
    paired = [file for file in image_files if file.name.lower().startswith("test-") and ("-front." in file.name.lower() or "-back." in file.name.lower())]
    fixtures = paired or image_files
    if not fixtures:
        raise SystemExit(f"No OCR image fixtures found in {fixtures_dir}")
    return fixtures


def process_tree(process: psutil.Process) -> list[psutil.Process]:
    processes = [process]
    try:
        processes.extend(process.children(recursive=True))
    except psutil.Error:
        pass
    return processes


def sample_process_tree(process: psutil.Process, stop: threading.Event, samples: list[dict[str, float]]) -> None:
    for proc in process_tree(process):
        with contextlib_suppress_psutil():
            proc.cpu_percent(interval=None)

    started = time.perf_counter()
    while not stop.wait(0.25):
        cpu_percent = 0.0
        rss_mib = 0.0
        live_processes = 0
        for proc in process_tree(process):
            try:
                cpu_percent += proc.cpu_percent(interval=None)
                rss_mib += proc.memory_info().rss / 2**20
                live_processes += 1
            except psutil.Error:
                continue
        samples.append(
            {
                "t": time.perf_counter() - started,
                "processTreeCpuPercent": cpu_percent,
                "observedBusyVcpus": cpu_percent / 100,
                "rssMiB": rss_mib,
                "processes": live_processes,
            }
        )


class contextlib_suppress_psutil:
    def __enter__(self) -> None:
        return None

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> bool:
        return exc_type is not None and issubclass(exc_type, psutil.Error)


def read_json_line(child: subprocess.Popen[str], timeout_s: float) -> dict[str, Any]:
    result: dict[str, Any] = {}
    error: Exception | None = None

    def target() -> None:
        nonlocal result, error
        try:
            line = child.stdout.readline() if child.stdout else ""
            if not line:
                raise RuntimeError("Worker closed stdout")
            result = json.loads(line)
        except Exception as caught:  # noqa: BLE001
            error = caught

    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    thread.join(timeout_s)
    if thread.is_alive():
        raise TimeoutError(f"Timed out waiting for worker response after {timeout_s}s")
    if error:
        raise error
    return result


def cpu_times_seconds(process: psutil.Process) -> float:
    total = 0.0
    for proc in process_tree(process):
        try:
            times = proc.cpu_times()
            total += times.user + times.system
        except psutil.Error:
            continue
    return total


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--fixtures-dir", type=Path, default=ROOT / "test-ids")
    parser.add_argument("--cpu-threads", type=int, default=int(os.getenv("PADDLE_OCR_CPU_THREADS", "2")))
    parser.add_argument("--timeout-s", type=float, default=120)
    args = parser.parse_args()

    fixtures = load_fixtures(args.fixtures_dir)
    OUT.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    home = ROOT / ".paddle-cache"
    env.update(
        HOME=str(home),
        USERPROFILE=str(home),
        PADDLE_PDX_CACHE_HOME=str(home / "paddlex"),
        XDG_CACHE_HOME=str(home / "xdg"),
        PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK="True",
        PYTHONIOENCODING="utf-8",
        PADDLE_OCR_DEVICE="cpu",
        PADDLE_OCR_CPU_THREADS=str(args.cpu_threads),
        OMP_NUM_THREADS=str(args.cpu_threads),
        MKL_NUM_THREADS=str(args.cpu_threads),
        OPENBLAS_NUM_THREADS=str(args.cpu_threads),
        PADDLE_PDX_CPU_NUM_THREADS=str(args.cpu_threads),
    )

    print("Isolated PaddleOCR benchmark")
    print(f"Requests: {args.requests}")
    print(f"CPU threads configured for OCR: {args.cpu_threads}")
    print("Fixtures: " + ", ".join(file.name for file in fixtures))

    log_path = OUT / "worker.stderr.log"
    with log_path.open("w", encoding="utf-8") as stderr_log:
        child = subprocess.Popen(
            [sys.executable, str(WORKER)],
            cwd=str(WORKER.parent),
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=stderr_log,
            text=True,
            encoding="utf-8",
            bufsize=1,
        )

        worker_process = psutil.Process(child.pid)
        started_at = time.perf_counter()
        ready = read_json_line(child, args.timeout_s)
        startup_s = time.perf_counter() - started_at
        if ready.get("type") != "ready":
            raise RuntimeError(f"Unexpected worker startup response: {ready}")

        samples: list[dict[str, float]] = []
        stop = threading.Event()
        sampler = threading.Thread(target=sample_process_tree, args=(worker_process, stop, samples), daemon=True)
        sampler.start()

        results: list[dict[str, Any]] = []
        run_started_at = time.perf_counter()
        cpu_started_at = cpu_times_seconds(worker_process)
        cpu_finished_at = cpu_started_at
        try:
            for index in range(args.requests):
                fixture = fixtures[index % len(fixtures)]
                image_data = base64.b64encode(fixture.read_bytes()).decode("ascii")
                test_id = f"isolated-ocr-benchmark-{index + 1:03d}-{int(time.time() * 1000)}"
                payload = {"id": test_id, "imageData": image_data}

                request_started_at = time.perf_counter()
                assert child.stdin is not None
                child.stdin.write(json.dumps(payload) + "\n")
                child.stdin.flush()
                response = read_json_line(child, args.timeout_s)
                latency_ms = (time.perf_counter() - request_started_at) * 1000
                ok = not response.get("error")
                results.append(
                    {
                        "testId": test_id,
                        "fixture": fixture.name,
                        "ok": ok,
                        "latencyMs": latency_ms,
                        "lineCount": len(response.get("lines") or []),
                        "error": response.get("error"),
                    }
                )
                if (index + 1) % 10 == 0 or index + 1 == args.requests:
                    print(f"\rCompleted {index + 1}/{args.requests}", end="", flush=True)
            cpu_finished_at = cpu_times_seconds(worker_process)
        finally:
            stop.set()
            sampler.join(timeout=2)
            if child.stdin:
                child.stdin.close()
            if child.poll() is None:
                child.terminate()
                try:
                    child.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait(timeout=10)
            print()

        elapsed_s = time.perf_counter() - run_started_at
        cpu_elapsed_s = max(0.0, cpu_finished_at - cpu_started_at)

    successes = [result for result in results if result["ok"]]
    failures = [result for result in results if not result["ok"]]
    latencies = [float(result["latencyMs"]) for result in successes]
    cpu_samples = [sample["processTreeCpuPercent"] for sample in samples]
    busy_vcpu_samples = [sample["observedBusyVcpus"] for sample in samples]
    rss_samples = [sample["rssMiB"] for sample in samples]
    throughput = len(successes) / elapsed_s if elapsed_s > 0 else 0
    avg_busy_vcpus = statistics.mean(busy_vcpu_samples) if busy_vcpu_samples else 0

    summary = {
        "requestCount": args.requests,
        "successfulRequests": len(successes),
        "failedRequests": len(failures),
        "fixturesUsed": [file.name for file in fixtures],
        "worker": {
            "isolation": "single PaddleOCR Python worker process tree",
            "device": "cpu",
            "configuredCpuThreads": args.cpu_threads,
            "pid": child.pid,
            "startupSeconds": round_number(startup_s),
        },
        "elapsedSeconds": round_number(elapsed_s),
        "throughputRps": round_number(throughput),
        "latencyMs": {
            "average": round_number(statistics.mean(latencies), 2) if latencies else 0,
            "p50": round_number(percentile(latencies, 50), 2),
            "p90": round_number(percentile(latencies, 90), 2),
            "p95": round_number(percentile(latencies, 95), 2),
            "p99": round_number(percentile(latencies, 99), 2),
            "min": round_number(min(latencies), 2) if latencies else 0,
            "max": round_number(max(latencies), 2) if latencies else 0,
        },
        "isolatedCpu": {
            "samples": len(samples),
            "averageProcessTreeCpuPercent": round_number(statistics.mean(cpu_samples), 2) if cpu_samples else 0,
            "peakProcessTreeCpuPercent": round_number(max(cpu_samples), 2) if cpu_samples else 0,
            "averageObservedBusyVcpus": round_number(avg_busy_vcpus, 3),
            "peakObservedBusyVcpus": round_number(max(busy_vcpu_samples), 3) if busy_vcpu_samples else 0,
            "cpuSecondsTotal": round_number(cpu_elapsed_s, 3),
            "cpuSecondsPerSuccessfulRequest": round_number(cpu_elapsed_s / len(successes), 3) if successes else 0,
        },
        "memory": {
            "averageRssMiB": round_number(statistics.mean(rss_samples), 1) if rss_samples else 0,
            "peakRssMiB": round_number(max(rss_samples), 1) if rss_samples else 0,
        },
        "failedExamples": failures[:5],
    }

    out_path = OUT / f"report-{time.strftime('%Y%m%d-%H%M%S')}.json"
    out_path.write_text(json.dumps({"summary": summary, "samples": samples, "results": results}, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    print(f"Report written to {out_path.relative_to(ROOT)}")
    print(f"Worker stderr log written to {log_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
