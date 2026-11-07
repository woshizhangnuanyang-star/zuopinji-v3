"""Create browser-ready copies of supplied motion studies, preserving each clip."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
from pathlib import Path
import re
import subprocess
import imageio_ffmpeg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
STUDIES = [
    ('opening', '开合动画', 'Blender', [('happy', '开心', '1.开合动画（Blender）/1.开心.mp4', '1.开合动画（Blender）/1.png'), ('comfort', '安慰', '1.开合动画（Blender）/2.安慰.mp4', '1.开合动画（Blender）/2.png'), ('release', '解压', '1.开合动画（Blender）/3.解压.mp4', '1.开合动画（Blender）/3.png'), ('calm', '平静', '1.开合动画（Blender）/4.平静.mp4', '1.开合动画（Blender）/4.png')]),
    ('astronaut', '宇航员小场景', 'Blender', [('astronaut', '宇航员小场景', '2.宇航员小场景（Blender）.mp4', None)]),
    ('beach', '沙滩', 'Blender', [('beach', '沙滩', '3.沙滩（Blender）.mp4', None)]),
    ('art-school', 'ART SCHOOL', 'C4D', [('art-school', 'ART SCHOOL', '4.ART SCHOOL（C4D）.mp4', None)]),
    ('visualization', '可视化', 'Spline', [('visualization', '可视化', '5.可视化(Spline).mp4', None)]),
    ('audio-poster', '音画海报', 'TouchDesigner', [('audio-poster', '音画海报', '6.TD音画海报.mp4', None)]),
]


def export_clip(job):
    source_root, slug, clip = job
    clip_id, label, filename, supplied_poster = clip
    source = source_root / filename
    info = subprocess.run([FFMPEG, '-hide_banner', '-i', str(source)], capture_output=True).stderr.decode('utf-8', 'replace')
    duration_match = re.search(r'Duration: (\d+):(\d+):([\d.]+)', info)
    duration = int(duration_match[1]) * 3600 + int(duration_match[2]) * 60 + float(duration_match[3])
    video_line = next(line for line in info.splitlines() if 'Video:' in line)
    size = re.search(r'\b(\d{2,5})x(\d{2,5})\b', video_line)
    width, height = map(int, size.groups())
    factor = min(1, 1920 / width, 1080 / height)
    out_width, out_height = max(2, int(width * factor) // 2 * 2), max(2, int(height * factor) // 2 * 2)
    target = ROOT / 'public/motion' / slug
    target.mkdir(parents=True, exist_ok=True)
    output = target / f'{clip_id}.mp4'
    command = [FFMPEG, '-y', '-v', 'error', '-i', str(source), '-map', '0:v:0', '-map', '0:a?', '-vf', f'scale={out_width}:{out_height}:flags=lanczos,fps=30,setsar=1', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-threads', '2', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(output)]
    subprocess.run(command, check=True, capture_output=True)
    assert output.stat().st_size < 24 * 1024 * 1024, f'{clip_id} exceeds asset budget'
    if supplied_poster:
        poster = Image.open(source_root / supplied_poster).convert('RGB')
    else:
        frame = subprocess.run([FFMPEG, '-v', 'error', '-ss', str(min(duration * .2, 2)), '-i', str(source), '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], check=True, capture_output=True).stdout
        poster = Image.open(BytesIO(frame)).convert('RGB')
    poster.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
    poster.save(target / f'{clip_id}.webp', quality=93, method=5)
    print(f'{slug}/{clip_id}: {duration:.2f}s, {out_width}x{out_height}, {output.stat().st_size / 1048576:.2f} MiB', flush=True)
    return slug, {'id': clip_id, 'label': label, 'src': f'/motion/{slug}/{clip_id}.mp4', 'poster': f'/motion/{slug}/{clip_id}.webp', 'width': out_width, 'height': out_height, 'duration': duration}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-root', type=Path, required=True)
    args = parser.parse_args()
    jobs = [(args.source_root, slug, clip) for slug, _, _, clips in STUDIES for clip in clips]
    with ThreadPoolExecutor(max_workers=2) as executor:
        exported = list(executor.map(export_clip, jobs))
    result = []
    for slug, title, software, _ in STUDIES:
        clips = [clip for group, clip in exported if group == slug]
        result.append({'id': f'motion-{slug}', 'title': title, 'software': software, 'clips': clips})
    (ROOT / 'src/data/motion.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
