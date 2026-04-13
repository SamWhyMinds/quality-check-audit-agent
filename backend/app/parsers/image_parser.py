"""
Image parser — extracts text from PNG/JPEG using pytesseract OCR (free, local).
Falls back to a descriptive placeholder if Tesseract is not installed.

To enable full OCR:
  Windows: Download Tesseract from https://github.com/UB-Mannheim/tesseract/wiki
            then set TESSERACT_CMD in your .env (e.g. C:/Program Files/Tesseract-OCR/tesseract.exe)
  Linux:   sudo apt install tesseract-ocr
  Mac:     brew install tesseract
"""
import os
import logging
from pathlib import Path
from .base import BaseParser, ParsedContent

logger = logging.getLogger(__name__)


class ImageParser(BaseParser):
    supported_extensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]

    def parse(self, filepath: str) -> ParsedContent:
        result = self._make_result(filepath, "image")
        result.extraction_method = "ocr-tesseract"
        filename = os.path.basename(filepath)

        try:
            from PIL import Image
            import pytesseract

            # Allow override of tesseract path via env var
            tesseract_cmd = os.environ.get("TESSERACT_CMD")
            if tesseract_cmd:
                pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

            img = Image.open(filepath)
            # Upscale small images for better OCR accuracy
            w, h = img.size
            if max(w, h) < 1000:
                scale = 1000 / max(w, h)
                img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

            text = pytesseract.image_to_string(img).strip()
            if text:
                result.text_content = f"[OCR extracted from {filename}]\n{text}"
                result.extraction_method = "ocr-tesseract"
            else:
                result.text_content = f"[Image file: {filename} — OCR found no text]"

        except ImportError:
            result.text_content = (
                f"[Image file: {filename} — pytesseract not installed. "
                "Install Tesseract + pytesseract to enable OCR.]"
            )
            result.extraction_method = "ocr-unavailable"
        except Exception as exc:
            logger.warning(f"OCR failed for {filename}: {exc}")
            result.text_content = f"[Image file: {filename} — OCR error: {exc}]"
            result.error = str(exc)

        return result
