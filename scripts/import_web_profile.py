"""Export supplied website designs and the profile portrait for the portfolio."""
import argparse
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WEBSITES = [
    ('web-physics', 'physics.jpg'),
    ('web-automation', 'automation.jpg'),
    ('web-health-governance', 'health-governance.jpg'),
    ('web-nanjing-info', 'nanjing-info.jpg'),
    ('web-nanjing-forestry', '南京林业大学（现代分析测试中心）.png'),
    ('web-heilongjiang', '黑龙江农业职业技术学院.png'),
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ui-root', type=Path, required=True)
    parser.add_argument('--source-root', type=Path, required=True)
    args = parser.parse_args()
    path = ROOT / 'src/data/case-studies.json'
    manifest = json.loads(path.read_text(encoding='utf-8'))
    for slug, filename in WEBSITES:
        source = (args.ui_root if filename.endswith('.jpg') else args.source_root) / filename
        with Image.open(source) as original:
            image = original.convert('RGB')
            assert image.width == 1920
            target = ROOT / 'public/projects' / slug
            target.mkdir(parents=True, exist_ok=True)
            cover = image.crop((0, 0, image.width, 1080)).resize((1200, 675), Image.Resampling.LANCZOS)
            cover.save(target / 'cover.webp', quality=93, method=5)
            pages = []
            for part, top in enumerate(range(0, image.height, 1920), 1):
                tile = image.crop((0, top, image.width, min(top + 1920, image.height)))
                stem = f'01-{part:02d}'
                tile.save(target / f'{stem}.webp', quality=94, method=5)
                tile.resize((960, round(tile.height / 2)), Image.Resampling.LANCZOS).save(target / f'{stem}-960.webp', quality=93, method=5)
                pages.append({'src': f'/projects/{slug}/{stem}.webp', 'small': f'/projects/{slug}/{stem}-960.webp', 'width': tile.width, 'height': tile.height, 'sourcePage': 1, 'part': part, 'label': '完整网页设计', 'chapter': '完整网页设计' if part == 1 else None})
            assert sum(p['height'] for p in pages) == image.height
            manifest[slug] = {'cover': f'/projects/{slug}/cover.webp', 'coverWidth': 1200, 'coverHeight': 675, 'sourceCount': 1, 'sourceHeight': image.height, 'pages': pages}
            print(f'{slug}: {image.width}x{image.height}, {len(pages)} tiles', flush=True)
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    portrait = ROOT / 'public/assets/about'
    portrait.mkdir(parents=True, exist_ok=True)
    with Image.open(args.source_root / '简介.png') as original:
        assert original.size == (1920, 1080)
        original.convert('RGB').crop((118, 159, 569, 734)).save(portrait / 'zhang-nuanyang.webp', quality=95, method=5)
    print('Profile portrait exported without changing the source image.', flush=True)


if __name__ == '__main__':
    main()
