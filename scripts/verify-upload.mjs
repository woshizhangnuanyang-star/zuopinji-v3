import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const files = JSON.parse(await readFile(new URL('./upload-assets.json', import.meta.url), 'utf8'));
const missing = [];
for (const file of files) {
  try {
    const info = await stat(new URL(file, root));
    if (!info.isFile()) missing.push(file);
  } catch { missing.push(file); }
}
if (missing.length) {
  console.error('上传尚未完整，请补齐下面的文件：\n' + missing.join('\n'));
  process.exitCode = 1;
} else {
  console.log('全部 ' + files.length + ' 个网站素材已就位：' + fileURLToPath(root));
}
