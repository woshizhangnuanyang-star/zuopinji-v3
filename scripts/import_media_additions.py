"""Import TD posters and light installation as responsive, on-demand media.

Original files are never modified. Each full-length MP4 stays below the static
asset limit; mobile copies and small thumbnails avoid fetching desktop assets.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re
import subprocess
import sys

import imageio_ffmpeg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def probe(source):
    info = subprocess.run([FFMPEG, '-hide_banner', '-i', str(source)], capture_output=True).stderr.decode('utf-8', 'replace')
    duration = re.search(r'Duration: (\d+):(\d+):([\d.]+)', info)
    video = next(line for line in info.splitlines() if 'Video:' in line)
    width, height = map(int, re.search(r'\b(\d{2,5})x(\d{2,5})\b', video).groups())
    return width, height, int(duration[1]) * 3600 + int(duration[2]) * 60 + float(duration[3])


def responsive_poster(image, directory, name):
    result = {}
    for suffix, size, quality in [('large', (1600, 2400), 91), ('thumb', (480, 720), 85)]:
        copy = image.copy()
        copy.thumbnail(size, Image.Resampling.LANCZOS)
        path = directory / f'{name}-{suffix}.webp'
        copy.save(path, quality=quality, method=6)
        result[suffix] = '/' + path.relative_to(ROOT / 'public').as_posix()
    result.update(width=image.width, height=image.height)
    return result


def export_clip(job):
    group, clip_id, label, source = job
    width, height, duration = probe(source)
    fingerprint = sha256(f'{source.name}:{source.stat().st_size}:{source.stat().st_mtime_ns}:responsive-v1'.encode()).hexdigest()[:8]
    directory = ROOT / 'public/media' / group
    directory.mkdir(parents=True, exist_ok=True)
    versions = {}
    for kind, max_width, max_height, crf, budget, audio in [('hd', 1920, 1080, 22, 21, 128), ('stream', 1280, 720, 24, 13, 96)]:
        factor = min(1, max_width / width, max_height / height)
        w, h = max(2, int(width * factor) // 2 * 2), max(2, int(height * factor) // 2 * 2)
        path = directory / f'{clip_id}-{kind}-{fingerprint}.mp4'
        # Cap the video rate to the complete clip's byte budget, including audio.
        rate = max(160, min(4000, int(budget * 1048576 * 8 / duration / 1000) - audio - 50))
        if not path.exists():
            subprocess.run([FFMPEG, '-y', '-v', 'error', '-i', str(source), '-map', '0:v:0', '-map', '0:a?',
                '-vf', f'scale={w}:{h}:flags=lanczos,fps=30,setsar=1', '-c:v', 'libx264', '-preset', 'medium',
                '-crf', str(crf), '-maxrate', f'{rate}k', '-bufsize', f'{rate * 2}k', '-threads', '2',
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', f'{audio}k', '-movflags', '+faststart', str(path)], check=True, capture_output=True)
        assert path.stat().st_size < 24 * 1048576, f'{path.name} exceeds static asset limit'
        versions[kind] = {'src': '/' + path.relative_to(ROOT / 'public').as_posix(), 'width': w, 'height': h, 'bytes': path.stat().st_size}
    frame = subprocess.run([FFMPEG, '-v', 'error', '-ss', str(min(duration * .16, 8)), '-i', str(source), '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], check=True, capture_output=True).stdout
    image = Image.open(BytesIO(frame)).convert('RGB')
    image.thumbnail((1280, 1080), Image.Resampling.LANCZOS)
    posters = responsive_poster(image, directory, f'{clip_id}-{fingerprint}')
    result = {'id': clip_id, 'label': label, **versions['hd'], 'small': versions['stream'], 'poster': posters['large'], 'thumbnail': posters['thumb'], 'duration': duration}
    print(json.dumps({'clip': clip_id, 'duration': duration, 'originalMiB': round(source.stat().st_size / 1048576, 2), 'hdMiB': round(versions['hd']['bytes'] / 1048576, 2), 'streamMiB': round(versions['stream']['bytes'] / 1048576, 2)}, ensure_ascii=False), flush=True)
    return group, result


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('--td-root', type=Path, required=True)
    parser.add_argument('--light-preview', type=Path, required=True)
    parser.add_argument('--light-study', type=Path, required=True)
    parser.add_argument('--audio-poster', type=Path, required=True)
    args = parser.parse_args()
    videos = args.td_root / '小组结课作业视频'
    jobs = [
        ('td-posters', 'xing-landscape', '行之所至 · 横版', videos / '行之所至（横）.mp4'),
        ('td-posters', 'xing-portrait', '行之所至 · 竖版', videos / '行之所至（竖）.mp4'),
        ('td-posters', 'chariot-landscape', '器构舆轮 · 横版', videos / '器构舆轮（横）.mp4'),
        ('td-posters', 'chariot-portrait', '器构舆轮 · 竖版', videos / '器构舆轮（竖）.mp4'),
        ('silent-archive', 'installation', '装置片段', args.light_preview),
        ('silent-archive', 'full-film', '完整作品', args.light_study),
        ('audio-poster', 'audio-poster', '音画海报', args.audio_poster),
    ]
    with ThreadPoolExecutor(max_workers=2) as executor:
        exported = list(executor.map(export_clip, jobs))
    posters = []
    directory = ROOT / 'public/media/td-posters'
    for name, label in [('海报3.png', '行之所至 / 01'), ('海报4.png', '行之所至 / 02'), ('海报1.jpg', '器构舆轮 / 01'), ('海报2.jpg', '器构舆轮 / 02')]:
        image = Image.open(args.td_root / '小组结课作业海报' / name).convert('RGB')
        paths = responsive_poster(image, directory, f'poster-{len(posters) + 1}')
        posters.append({'id': f'poster-{len(posters) + 1}', 'label': label, 'src': paths['large'], 'thumbnail': paths['thumb'], 'width': paths['width'], 'height': paths['height']})
    result = {
        'tdPosters': {'id': 'motion-td-posters', 'title': 'TD 动态海报设计', 'software': 'TouchDesigner', 'clips': [clip for group, clip in exported if group == 'td-posters'], 'posters': posters},
        'silentArchive': {'id': 'other-silent-archive', 'title': '缄默的存档', 'software': '智能光影设计', 'clips': [clip for group, clip in exported if group == 'silent-archive']},
    }
    (ROOT / 'src/data/media-additions.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    motion_path = ROOT / 'src/data/motion.json'
    studies = json.loads(motion_path.read_text(encoding='utf-8'))
    audio_study = next(study for study in studies if study['id'] == 'motion-audio-poster')
    audio_study['clips'] = [next(clip for group, clip in exported if group == 'audio-poster')]
    motion_path.write_text(json.dumps(studies, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
