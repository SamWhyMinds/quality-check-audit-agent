"""
Abstract base parser and ParsedContent dataclass.
All parsers implement BaseParser.parse(filepath) -> ParsedContent.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class ParsedContent:
    filename: str
    filepath: str
    file_type: str                        # Extension without dot: "docx", "pdf", etc.
    text_content: Optional[str] = None    # Extracted text (None for pure-image files)
    image_data: Optional[str] = None      # Base64-encoded image data (PNG/JPEG)
    image_media_type: Optional[str] = None
    page_count: Optional[int] = None
    sheet_names: Optional[List[str]] = None
    extraction_method: str = "unknown"
    error: Optional[str] = None
    size_bytes: int = 0

    @property
    def is_image(self) -> bool:
        return self.file_type in {"png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff"}

    @property
    def has_content(self) -> bool:
        return bool(self.text_content or self.image_data)

    @property
    def text_preview(self) -> str:
        if self.text_content:
            return self.text_content[:500]
        return ""


class BaseParser(ABC):
    supported_extensions: list[str] = []

    @abstractmethod
    def parse(self, filepath: str) -> ParsedContent:
        """Extract content from a file. Must not raise — set error field instead."""
        ...

    def _make_result(self, filepath: str, file_type: str) -> ParsedContent:
        import os
        return ParsedContent(
            filename=os.path.basename(filepath),
            filepath=filepath,
            file_type=file_type,
            size_bytes=os.path.getsize(filepath) if os.path.exists(filepath) else 0,
        )
