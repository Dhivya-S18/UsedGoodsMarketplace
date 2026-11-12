from pathlib import Path
from uuid import uuid4


UPLOAD_DIRECTORY = Path(__file__).resolve().parents[1] / "uploads"
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024


def store_product_image(contents: bytes, content_type: str) -> str:
    image_types = {
        "image/jpeg": (".jpg", contents.startswith(b"\xff\xd8\xff")),
        "image/png": (".png", contents.startswith(b"\x89PNG\r\n\x1a\n")),
        "image/webp": (
            ".webp",
            contents.startswith(b"RIFF") and contents[8:12] == b"WEBP"
        )
    }

    image_type = image_types.get(content_type)
    if not image_type or not image_type[1]:
        raise ValueError("Choose a valid JPG, PNG, or WebP image.")

    UPLOAD_DIRECTORY.mkdir(exist_ok=True)
    filename = f"{uuid4().hex}{image_type[0]}"
    (UPLOAD_DIRECTORY / filename).write_bytes(contents)
    return f"/uploads/{filename}"
