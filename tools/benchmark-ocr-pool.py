"""Two persistent OCR workers, synchronized after warmup; no OCR text retained."""
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
import time
import psutil
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--threads', type=int, default=4)
args = parser.parse_args()

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'ocr-cpu-benchmark'
OUT.mkdir(parents=True, exist_ok=True)
env = os.environ.copy()
home = ROOT / '.paddle-cache'
env.update(HOME=str(home), USERPROFILE=str(home), PADDLE_PDX_CACHE_HOME=str(home/'paddlex'),
           XDG_CACHE_HOME=str(home/'xdg'), PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK='True',
           PYTHONIOENCODING='utf-8', FLAGS_use_mkldnn='0', FLAGS_use_onednn='0')
for name in ['pool-go', 'pool-ready-0', 'pool-ready-1']:
    (OUT/name).unlink(missing_ok=True)
children, logs, samples = [], [], []
try:
    for i in range(2):
        log = (OUT/f'pool-{i}.log').open('w', encoding='utf-8')
        logs.append(log)
        child = subprocess.Popen([sys.executable, str(ROOT/'tools/benchmark-ocr-cpu.py'),
                                  '--worker', str(args.threads), '--pool-id', str(i)], env=env, stdout=log, stderr=log)
        children.append(child)
    processes = [psutil.Process(c.pid) for c in children]
    deadline = time.monotonic()+180
    while not all((OUT/f'pool-ready-{i}').exists() for i in range(2)):
        if any(c.poll() is not None for c in children) or time.monotonic()>deadline:
            raise RuntimeError('Pool warmup failed or timed out')
        time.sleep(0.5)
    for p in processes:
        p.cpu_percent()
    psutil.cpu_percent()
    start = time.monotonic()
    (OUT/'pool-go').touch()
    print(f'Two warmed {args.threads}-thread workers started', flush=True)
    while any(c.poll() is None for c in children):
        time.sleep(0.5)
        cpu = rss = 0
        for p in processes:
            try:
                cpu += p.cpu_percent()
                rss += p.memory_info().rss/2**20
            except psutil.NoSuchProcess:
                pass
        samples.append(dict(cpu_pct=cpu, rss_mib=rss, system_cpu_pct=psutil.cpu_percent()))
        if time.monotonic()>deadline:
            raise TimeoutError('Pool benchmark timed out')
    elapsed = time.monotonic()-start
    for c in children:
        if c.wait()!=0:
            raise RuntimeError('Pool worker failed')
    records = [json.loads((OUT/f'pool-worker-{i}.json').read_text()) for i in range(2)]
    warm = [r for record in records for r in record['runs'] if r['cycle']>0]
    summary = dict(workers=2, threads_each=args.threads, warm_images=len(warm),
                   batch_wall_s=elapsed, images_per_s=len(warm)/elapsed,
                   mean_image_wall_s=statistics.mean(r['wall_s'] for r in warm),
                   mean_image_cpu_s=statistics.mean(r['cpu_s'] for r in warm),
                   peak_pool_rss_mib=max(s['rss_mib'] for s in samples),
                   mean_pool_cpu_pct=statistics.mean(s['cpu_pct'] for s in samples),
                   mean_system_cpu_pct=statistics.mean(s['system_cpu_pct'] for s in samples))
    (OUT/f'pool-report-{args.threads}.json').write_text(json.dumps(dict(summary=summary,samples=samples,workers=records),indent=2))
    print(json.dumps(summary,indent=2))
finally:
    for c in children:
        if c.poll() is None:
            c.terminate()
            c.wait(timeout=10)
    for log in logs:
        log.close()
