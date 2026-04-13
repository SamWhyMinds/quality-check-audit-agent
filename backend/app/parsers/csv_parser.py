"""CSV parser — extracts tabular text via pandas."""
from .base import BaseParser, ParsedContent
from ..config import get_settings


class CsvParser(BaseParser):
    supported_extensions = [".csv"]

    def parse(self, filepath: str) -> ParsedContent:
        result = self._make_result(filepath, "csv")
        result.extraction_method = "pandas"
        max_chars = get_settings().max_chars_per_file
        try:
            import pandas as pd
            df = pd.read_csv(filepath, nrows=150)
            result.text_content = df.to_string(max_rows=150)[:max_chars]
        except Exception as exc:
            result.error = str(exc)
            result.text_content = f"[Could not read CSV: {exc}]"
        return result
