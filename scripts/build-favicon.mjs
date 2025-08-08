import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const publicDir = path.join(projectRoot, 'public');
  const svgPath = path.join(publicDir, 'favicon.svg');
  const icoPath = path.join(publicDir, 'favicon.ico');

  try {
    await mkdir(publicDir, { recursive: true });
    const svgBuffer = await readFile(svgPath);

    // 生成多尺寸 PNG
    const sizes = [16, 32, 48, 64, 128, 256];
    const pngBuffers = await Promise.all(
      sizes.map((size) => sharp(svgBuffer).resize(size, size, { fit: 'contain' }).png().toBuffer())
    );

    // 合成為 ICO
    const icoBuffer = await toIco(pngBuffers);
    await writeFile(icoPath, icoBuffer);
    console.log('✅ Favicon generated at', icoPath);
  } catch (err) {
    console.error('❌ Failed to generate favicon:', err);
    process.exit(1);
  }
}

main();


