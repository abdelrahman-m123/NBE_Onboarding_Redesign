import contextlib
import json
import os
import sys
from pathlib import Path
import base64
import io

import numpy as np
from PIL import Image
import paddle
from paddleocr import PaddleOCR

from paddle_ocr_runner import normalize_result


def resolve_device():
    requested_device = os.getenv("PADDLE_OCR_DEVICE", "auto").lower()
    if requested_device in ("auto", "gpu", "gpu:0") and paddle.device.is_compiled_with_cuda():
        return "gpu:0"
    if requested_device == "auto":
        return "cpu"
    if requested_device in ("gpu", "gpu:0"):
        raise RuntimeError(
            "GPU OCR requested, but the installed Paddle package is not CUDA-enabled. "
            "Install paddlepaddle-gpu and verify the CUDA runtime before benchmarking."
        )
    if requested_device in ("", "none"):
        return None
    return requested_device


def build_ocr():
    device = resolve_device()
    kwargs = dict(
        lang="ar",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    if device:
        kwargs["device"] = device

    cpu_threads = int(os.getenv("PADDLE_OCR_CPU_THREADS", "2"))
    if device == "cpu" and cpu_threads > 0:
        os.environ.setdefault("OMP_NUM_THREADS", str(cpu_threads))
        os.environ.setdefault("MKL_NUM_THREADS", str(cpu_threads))
        os.environ.setdefault("OPENBLAS_NUM_THREADS", str(cpu_threads))
        os.environ.setdefault("PADDLE_PDX_CPU_NUM_THREADS", str(cpu_threads))
        kwargs["enable_mkldnn"] = True
        kwargs["cpu_threads"] = cpu_threads
        kwargs["engine_config"] = {
            "paddle_static": {
                "device_type": "cpu",
                "cpu_threads": cpu_threads,
                "run_mode": "mkldnn",
            },
        }

    det_model_dir = os.getenv("PADDLE_OCR_DET_MODEL_DIR")
    rec_model_dir = os.getenv("PADDLE_OCR_REC_MODEL_DIR")
    if det_model_dir:
        kwargs["text_detection_model_dir"] = det_model_dir
    if rec_model_dir:
        kwargs["text_recognition_model_dir"] = rec_model_dir

    try:
        return PaddleOCR(**kwargs)
    except TypeError:
        fallback_kwargs = dict(
            lang="ar",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
        if device:
            fallback_kwargs["device"] = device
        return PaddleOCR(**fallback_kwargs)


def write(payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    with contextlib.redirect_stdout(sys.stderr):
        ocr = build_ocr()

    write({"type": "ready"})

    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line:
            continue

        try:
            request = json.loads(raw_line)
            request_id = request.get("id")
            image_data = request.get("imageData")

            if image_data:
                # Fast path: image was base64-encoded by Node and piped via stdin.
                # Decode directly to a numpy array — no disk I/O needed.
                img_bytes = base64.b64decode(image_data)
                img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                img_array = np.array(img)
                with contextlib.redirect_stdout(sys.stderr):
                    raw_result = ocr.predict(img_array)
            else:
                # Fallback: legacy imagePath (used by paddle_ocr_runner.py CLI).
                image_path = Path(str(request.get("imagePath", "")))
                if not image_path.exists():
                    write({"id": request_id, "error": f"Image does not exist: {image_path}"})
                    continue
                with contextlib.redirect_stdout(sys.stderr):
                    raw_result = ocr.predict(str(image_path))

            write({"id": request_id, "lines": normalize_result(raw_result)})
        except Exception as error:
            write({"id": request.get("id") if "request" in locals() else None, "error": str(error)})


if __name__ == "__main__":
    main()
