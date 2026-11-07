"""Create smaller display copies of the existing botanical illustrations."""
from pathlib import Path
from PIL import Image

assets = Path(__file__).resolve().parents[1] / 'public/assets'
for name, variant, width, quality in [
    ('elowen-flower-border', 'display', 1000, 77),
    ('elowen-flower-border', 'mobile', 640, 76),
    ('portfolio-botanical-elowen', 'display', 1400, 80),
    ('portfolio-botanical-elowen', 'mobile', 768, 80),
]:
    original = assets / f'{name}-light.webp'
    image = Image.open(original)
    image.thumbnail((width, width), Image.Resampling.LANCZOS)
    output = assets / f'{name}-{variant}.webp'
    image.save(output, quality=quality, method=6)
    print(f'{output.name}: {original.stat().st_size} -> {output.stat().st_size} bytes')
