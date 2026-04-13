"""PDF parser — pdfplumber primary, pypdf fallback."""
from .base import BaseParser, ParsedContent
from ..config import get_settings


class PdfParser(BaseParser):
    supported_extensions = [".pdf"]

    def parse(self, filepath: str) -> ParsedContent:
        result = self._make_result(filepath, "pdf")
        max_chars = get_settings().max_chars_per_file
        try:
            import pdfplumber
            result.extraction_method = "pdfplumber"
            texts = []
            with pdfplumber.open(filepath) as pdf:
                result.page_count = len(pdf.pages)
                for page in pdf.pages[:20]:
                    t = page.extract_text()
                    if t:
                        texts.append(t.strip())
            if texts:
                combined = "\n\n".join(texts)
                if len(combined) > max_chars:
                    result.text_content = combined[:max_chars] + f"\n...[truncated, {result.page_count} pages total]"
                else:
                    result.text_content = combined
            else:
                result.text_content = f"[Scanned PDF — {result.page_count} pages, no extractable text. Consider OCR.]"
        except ImportError:
            try:
                from pypdf import PdfReader
                result.extraction_method = "pypdf"
                reader = PdfReader(filepath)
                result.page_count = len(reader.pages)
                texts = [p.extract_text() for p in reader.pages[:20] if p.extract_text()]
                combined = "\n\n".join(texts)
                if len(combined) > max_chars:
                    result.text_content = combined[:max_chars] + "\n...[truncated]"
                else:
                    result.text_content = combined or f"[No text layer — {result.page_count} pages]"
            except Exception as exc2:
                result.error = str(exc2)
                result.text_content = f"[Could not read PDF: {exc2}]"
        except Exception as exc:
            result.error = str(exc)
            result.text_content = f"[Could not read PDF: {exc}]"
        return result
