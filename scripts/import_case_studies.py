"""Prepare supplied portfolio slices without cropping or changing their order."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PROJECTS = [
    ('gugu-island', '咕咕岛', [('项目概览', 1), ('设计背景', 2), ('用户研究', 8), ('设计规范', 11), ('产品与架构', 14), ('界面与体验', 20)]),
    ('goodboy', 'GoodBoy/GOODBOY', [('项目概览', 1), ('问题与用户', 2), ('竞品分析', 5), ('方案设计', 6), ('应用与界面', 11), ('开发与实现', 12), ('应用前景', 13)]),
    ('lingfu', '灵馥/灵馥', [('项目概览', 1), ('调研与洞察', 2), ('品牌与 IP', 7), ('体验与架构', 11), ('界面设计', 15), ('硬件与 VR', 22)]),
    ('yaya-rangers', '牙牙奇兵局_slices', [('项目概览', 1), ('调研与用户', 2), ('需求与策略', 9), ('方案定位', 18), ('硬件与交互', 22), ('界面与智能体', 29)]),
    ('kunqu-rhythm', '昆曲韵动_slices', [('项目概览', 1), ('背景与洞察', 2), ('用户研究', 5), ('服务设计', 8), ('界面设计', 11), ('文创与场景', 14)]),
    ('her-view', '她视界_slices', [('项目概览', 1), ('背景与目标', 2), ('用户研究', 4), ('品牌与视觉', 9), ('产品与交互', 12), ('最终呈现', 14)]),
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--only', nargs='+', choices=[p[0] for p in PROJECTS])
    args = parser.parse_args()
    manifest_path = ROOT / 'src' / 'data' / 'case-studies.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    for slug, folder, chapters in PROJECTS:
        if args.only and slug not in args.only:
            continue
        source = args.source_root / folder
        def page_number(path):
            if path.stem.isdecimal():
                return int(path.stem)
            match = re.search(r'_(\d+)_01$', path.stem) if slug in ('kunqu-rhythm', 'her-view') else None
            return int(match.group(1)) if match else None
        files = sorted((p for p in source.glob('*.png') if page_number(p) is not None), key=page_number)
        assert [page_number(p) for p in files] == list(range(1, len(files) + 1))
        if slug == 'lingfu':
            files.append(source / '展开_24_01.png')
        assert files, f'No source slices found for {slug}'
        override = args.source_root / 'GOODBOY封面.png' if slug == 'goodboy' else None
        revision = None
        if override and override.is_file():
            files[0] = override
            revision = hashlib.sha256(override.read_bytes()).hexdigest()[:10]
        cover_name = f'cover-{revision}.webp' if revision else 'cover.webp'
        target = ROOT / 'public' / 'projects' / slug
        target.mkdir(parents=True, exist_ok=True)
        pages = []
        source_height = 0
        active_label = ''
        chapter_map = dict((n, label) for label, n in chapters)
        for n, path in enumerate(files, 1):
            with Image.open(path) as original:
                assert original.width == 1920
                # Source backgrounds are opaque. Keep all source pixels and proportions.
                image = original.convert('RGB')
                source_height += image.height
                active_label = chapter_map.get(n, active_label)
                if n == 1:
                    cover = image.copy()
                    cover.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
                    cover.save(target / cover_name, quality=92, method=5)
                    cover_size = cover.size
                for part, top in enumerate(range(0, image.height, 1920), 1):
                    tile = image.crop((0, top, image.width, min(top + 1920, image.height)))
                    stem = f'{n:02d}-{part:02d}'
                    if n == 1 and revision:
                        stem += f'-{revision}'
                    tile.save(target / f'{stem}.webp', quality=93, method=5)
                    mobile = tile.resize((960, round(tile.height / 2)), Image.Resampling.LANCZOS)
                    mobile.save(target / f'{stem}-960.webp', quality=92, method=5)
                    pages.append({'src': f'/projects/{slug}/{stem}.webp', 'small': f'/projects/{slug}/{stem}-960.webp', 'width': tile.width, 'height': tile.height, 'sourcePage': n, 'part': part, 'label': active_label, 'chapter': chapter_map.get(n) if part == 1 else None})
        assert sum(p['height'] for p in pages) == source_height
        manifest[slug] = {'cover': f'/projects/{slug}/{cover_name}', 'coverWidth': cover_size[0], 'coverHeight': cover_size[1], 'sourceCount': len(files), 'sourceHeight': source_height, 'pages': pages}
        total = sum(p.stat().st_size for p in target.glob('*.webp'))
        print(f'{slug}: {len(files)} source slices, {len(pages)} tiles, {source_height}px total, {total / 1048576:.2f} MiB', flush=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
