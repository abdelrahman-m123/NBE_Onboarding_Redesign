"""Local OCR capacity diagnostic. Reports timings/resources, never extracted text."""
import argparse
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'ocr-cpu-benchmark'


def worker(threads, pool_id=None):
    if threads:
        for key in ['OMP_NUM_THREADS', 'MKL_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'PADDLE_PDX_CPU_NUM_THREADS']:
            os.environ[key] = str(threads)
    started = time.perf_counter()
    import paddle
    from paddleocr import PaddleOCR
    imported = time.perf_counter()
    cache = ROOT / '.paddle-cache' / 'paddlex' / 'official_models'
    kwargs = dict(lang='ar', device='cpu', use_doc_orientation_classify=False,
                  use_doc_unwarping=False, use_textline_orientation=False,
                  text_detection_model_name='PP-OCRv5_server_det',
                  text_recognition_model_name='arabic_PP-OCRv5_mobile_rec',
                  text_detection_model_dir=str(cache / 'PP-OCRv5_server_det'),
                  text_recognition_model_dir=str(cache / 'arabic_PP-OCRv5_mobile_rec'))
    if threads:
        kwargs.update(engine='paddle_static', engine_config=dict(device_type='cpu', cpu_threads=threads, run_mode='mkldnn'))
    ocr = PaddleOCR(**kwargs)
    initialized = time.perf_counter()
    files = [ROOT / 'test-ids' / name for name in ['test-national-id.png', 'image.png', 'image copy.png']]
    runs = []
    for cycle in range(3):
        if cycle == 1 and pool_id is not None:
            (OUT / f'pool-ready-{pool_id}').touch()
            deadline = time.monotonic() + 120
            while not (OUT / 'pool-go').exists():
                if time.monotonic() > deadline:
                    raise TimeoutError('Pool start barrier timed out')
                time.sleep(0.1)
        for index, file in enumerate(files):
            begin, cpu = time.perf_counter(), time.process_time()
            result = list(ocr.predict(str(file)))
            runs.append(dict(cycle=cycle, fixture=index + 1,
                             wall_s=time.perf_counter()-begin,
                             cpu_s=time.process_time()-cpu, pages=len(result)))
            print('BENCH_PASS ' + json.dumps(runs[-1]), flush=True)
    record = dict(threads=threads or 'default', explicit_engine=bool(threads), cuda_build=paddle.device.is_compiled_with_cuda(),
                  import_s=imported-started, model_init_s=initialized-imported, runs=runs)
    name = f'pool-worker-{pool_id}.json' if pool_id is not None else f'worker-{threads}.json'
    (OUT / name).write_text(json.dumps(record, indent=2))


def main(configs):
    import psutil
    OUT.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    home = ROOT / '.paddle-cache'
    env.update(HOME=str(home), USERPROFILE=str(home),
               PADDLE_PDX_CACHE_HOME=str(home / 'paddlex'), XDG_CACHE_HOME=str(home / 'xdg'),
               PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK='True', PYTHONIOENCODING='utf-8',
               FLAGS_use_mkldnn='0', FLAGS_use_onednn='0')
    baseline = psutil.cpu_percent(interval=1)
    report = dict(logical_cpus=psutil.cpu_count(), physical_cores=psutil.cpu_count(logical=False),
                  ram_gib=psutil.virtual_memory().total/2**30, baseline_system_cpu_pct=baseline,
                  configs=[])
    for threads in configs:
        print(f'RUN threads={threads or "default"}', flush=True)
        samples = []
        with (OUT / f'worker-{threads}.log').open('w', encoding='utf-8') as log:
            child = subprocess.Popen([sys.executable, str(Path(__file__)), '--worker', str(threads)],
                                     env=env, stdout=log, stderr=log)
            process = psutil.Process(child.pid)
            process.cpu_percent()
            begun = time.monotonic()
            while child.poll() is None:
                time.sleep(0.5)
                try:
                    samples.append(dict(t=time.monotonic()-begun,
                                        process_cpu_pct=process.cpu_percent(),
                                        rss_mib=process.memory_info().rss/2**20,
                                        system_cpu_pct=psutil.cpu_percent()))
                except psutil.NoSuchProcess:
                    break
                if time.monotonic()-begun > 240:
                    child.terminate()
                    child.wait(timeout=10)
                    break
        child.wait(timeout=10)
        record = dict(threads=threads, exit_code=child.returncode, samples=samples)
        result_path = OUT / f'worker-{threads}.json'
        if child.returncode == 0 and result_path.exists():
            record.update(json.loads(result_path.read_text()))
            warm = [r for r in record['runs'] if r['cycle'] > 0]
            record['warm_mean_wall_s'] = statistics.mean(r['wall_s'] for r in warm)
            record['warm_mean_cpu_s'] = statistics.mean(r['cpu_s'] for r in warm)
        record['peak_rss_mib'] = max((s['rss_mib'] for s in samples), default=0)
        record['mean_process_cpu_pct'] = statistics.mean(s['process_cpu_pct'] for s in samples) if samples else 0
        record['mean_system_cpu_pct'] = statistics.mean(s['system_cpu_pct'] for s in samples) if samples else 0
        report['configs'].append(record)
        (OUT / ('report-' + '-'.join(map(str, configs)) + '.json')).write_text(json.dumps(report, indent=2))
        print(json.dumps({k:v for k,v in record.items() if k not in ['samples','runs']}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--worker', type=int)
    parser.add_argument('--pool-id', type=int)
    parser.add_argument('--configs', type=int, nargs='+', default=[0, 2, 4])
    args = parser.parse_args()
    if args.worker is not None:
        worker(args.worker, args.pool_id)
    else:
        main(args.configs)
