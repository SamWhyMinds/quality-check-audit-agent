"""
File extension → parser class registry.
Dispatches any filepath to the appropriate parser.
"""
from pathlib import Path
from .base import BaseParser, ParsedContent
from .docx_parser import DocxParser
from .xlsx_parser import XlsxParser
from .csv_parser import CsvParser
from .pdf_parser import PdfParser
from .image_parser import ImageParser

_REGISTRY: dict[str, type[BaseParser]] = {}

for _cls in [DocxParser, XlsxParser, CsvParser, PdfParser, ImageParser]:
    for _ext in _cls.supported_extensions:
        _REGISTRY[_ext] = _cls

SUPPORTED_EXTENSIONS = set(_REGISTRY.keys())


def parse_file(filepath: str) -> ParsedContent:
    """Dispatch filepath to the correct parser. Returns ParsedContent with error set if unsupported."""
    ext = Path(filepath).suffix.lower()
    parser_cls = _REGISTRY.get(ext)
    if parser_cls is None:
        from .base import ParsedContent
        import os
        return ParsedContent(
            filename=Path(filepath).name,
            filepath=filepath,
            file_type=ext.lstrip(".") or "unknown",
            error=f"Unsupported file type: {ext}",
            text_content=f"[Unsupported file type: {ext}]",
            size_bytes=os.path.getsize(filepath) if os.path.exists(filepath) else 0,
        )
    return parser_cls().parse(filepath)


def parse_folder(folder_path: str, max_files: int = 50) -> list[ParsedContent]:
    """Walk a folder and parse all supported files (sorted by size, smallest first)."""
    import os
    all_files = []
    ignored = {"thumbs.db", "desktop.ini", ".ds_store"}
    for root, dirs, files in os.walk(folder_path):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for fname in files:
            if fname.startswith(".") or fname.lower() in ignored:
                continue
            if Path(fname).suffix.lower() in SUPPORTED_EXTENSIONS:
                all_files.append(os.path.join(root, fname))
    all_files.sort(key=lambda f: os.path.getsize(f) if os.path.exists(f) else 0)
    return [parse_file(fp) for fp in all_files[:max_files]]
