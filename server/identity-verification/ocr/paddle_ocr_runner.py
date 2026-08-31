import json
import os
import sys
from pathlib import Path

import paddle
from paddleocr import PaddleOCR


def normalize_result(raw_result):
    lines = []

    def first_value(node, keys):
        for key in keys:
            value = node.get(key)
            if value is not None:
                return value
        return None

    def normalize_box(box):
        if hasattr(box, "tolist"):
            return box.tolist()
        if isinstance(box, (list, tuple)):
            return list(box)
        return None

    def walk(node):
        if isinstance(node, dict):
            texts = node.get("rec_texts")
            scores = node.get("rec_scores")
            boxes = first_value(node, ("rec_polys", "dt_polys", "rec_boxes"))
            if isinstance(texts, list):
                for index, text in enumerate(texts):
                    lines.append({
                        "text": str(text),
                        "confidence": float(scores[index] if isinstance(scores, list) and index < len(scores) else 0),
                        "box": normalize_box(boxes[index]) if boxes is not None and index < len(boxes) else None,
                    })
                return

            text = node.get("text") or node.get("rec_text")
            confidence = node.get("confidence") or node.get("score") or node.get("rec_score")
            if text:
                lines.append({
                    "text": str(text),
                    "confidence": float(confidence or 0),
                    "box": node.get("box") or node.get("poly"),
                })
                return

            for value in node.values():
                walk(value)
            return

        if not isinstance(node, (list, tuple)):
            return

        if len(node) >= 2 and isinstance(node[1], (list, tuple)) and len(node[1]) >= 2 and isinstance(node[1][0], str):
            lines.append({
                "text": node[1][0],
                "confidence": float(node[1][1] or 0),
                "box": node[0],
            })
            return

        for item in node:
            walk(item)

    walk(raw_result)
    return lines


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    if len(sys.argv) < 2:
        raise SystemExit("Usage: paddle_ocr_runner.py <image-path>")

    image_path = Path(sys.argv[1])
    if not image_path.exists():
        raise SystemExit(f"Image does not exist: {image_path}")

    requested_device = os.getenv("PADDLE_OCR_DEVICE", "auto").lower()
    if requested_device in ("auto", "gpu", "gpu:0") and paddle.device.is_compiled_with_cuda():
        device = "gpu:0"
    elif requested_device == "auto":
        device = "cpu"
    elif requested_device in ("gpu", "gpu:0"):
        print(json.dumps({
            "warning": "PADDLE_OCR_DEVICE requested GPU, but installed Paddle is not CUDA-enabled. Falling back to CPU.",
        }), file=sys.stderr)
        device = "cpu"
    elif requested_device in ("", "none"):
        device = None
    else:
        device = requested_device

    try:
        kwargs = dict(
            lang="ar",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
        if device:
            kwargs["device"] = device
        ocr = PaddleOCR(**kwargs)
    except TypeError:
        ocr = PaddleOCR(lang="ar")

    raw_result = ocr.predict(str(image_path))
    lines = normalize_result(raw_result)

    print(json.dumps({"lines": lines}, ensure_ascii=False))


if __name__ == "__main__":
    main()
