"""Cut recorded UI footage into a shareable portrait MP4. No app source changes."""
from pathlib import Path
import json, os, subprocess, sys

base = Path(__file__).parent
timeline = json.loads((base / 'timeline.json').read_text())
assert timeline['shots'][-1]['name'] == 'outro', 'Capture must finish before rendering.'
assert not timeline['errors'], timeline['errors']
sys.path.insert(0, '/tmp/hint-demo-video-tools')
import imageio_ffmpeg
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

filters = []
edited = []
at = 0.0
for i, shot in enumerate(timeline['shots']):
    start, end = shot['start'], shot['end']
    duration = end - start
    filters.append(f'[0:v]trim=start={start:.3f}:end={end:.3f},setpts=PTS-STARTPTS[v{i}]')
    edited.append({'chapter': shot['name'], 'start': round(at, 3), 'end': round(at + duration, 3)})
    at += duration
filters.append(''.join(f'[v{i}]' for i in range(len(edited))) + f'concat=n={len(edited)}:v=1:a=0,scale=1080:1920:flags=lanczos,format=yuv420p[film]')
script = base / 'edit-filter.txt'
script.write_text(';\n'.join(filters))
video = base / 'Hint-App-Demo.mp4'
with (base / 'encode.log').open('w') as log:
    subprocess.run([ffmpeg, '-hide_banner', '-y', '-i', timeline['raw'], '-filter_complex_script', str(script), '-map', '[film]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', '25', '-movflags', '+faststart', '-metadata', 'title=Hint - A letter, every day', str(video)], stdout=log, stderr=subprocess.STDOUT, check=True)

subprocess.run([ffmpeg, '-hide_banner', '-y', '-ss', '5.3', '-i', str(video), '-frames:v', '1', str(base / 'Hint-App-Demo-Poster.png')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
subprocess.run([ffmpeg, '-hide_banner', '-y', '-i', str(video), '-vf', f'fps=1/{at/12:.3f},scale=270:480,tile=4x3', '-frames:v', '1', str(base / 'contact-sheet.jpg')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
(base / 'edit.json').write_text(json.dumps({'video': str(video), 'estimatedDuration': round(at,3), 'resolution': '1080x1920', 'frameRate':25, 'audio':'none', 'sampleData':True, 'chapters':edited}, indent=2)+'\n')
print(json.dumps({'file': str(video), 'duration': round(at,2), 'sizeMB': round(video.stat().st_size / 1_000_000,2)}))
