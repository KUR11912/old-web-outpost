import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Decode locally in Chromium; no remote runtime audio dependency or extra npm install.
// node audio_asset/prepare-footsteps.mjs <absolute path to playwright/index.mjs>
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const sourceDir = new URL('./source/', import.meta.url);
const outputDir = new URL('../public/audio/footsteps/', import.meta.url);
const sampleRate = 44100;
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report = [];
try {
  const page = await browser.newPage();
  for (const file of (await readdir(sourceDir)).filter(name => name.endsWith('.ogg')).sort()) {
    const input = await readFile(new URL(file, sourceDir));
    const { samples: raw, channels } = await page.evaluate(async ({ encoded, sampleRate }) => {
      const context = new OfflineAudioContext(1, 1, sampleRate);
      const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      const buffer = await context.decodeAudioData(bytes.buffer);
      const mono = new Float32Array(buffer.length);
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
      }
      return { samples: Array.from(mono), channels: buffer.numberOfChannels };
    }, { encoded: input.toString('base64'), sampleRate });
    const surface = file.includes('-grass-') ? 'grass' : 'stone';
    const index = Number(file.match(/-(\d{3})-/)[1]) + 1;
    const output = `${surface}-${String(index).padStart(2, '0')}.wav`;
    const mean = raw.reduce((sum, value) => sum + value, 0) / raw.length;
    const centered = raw.map(value => value - mean);
    const sourcePeak = Math.max(...centered.map(Math.abs));
    const threshold = sourcePeak * .008;
    let first = centered.findIndex(value => Math.abs(value) > threshold);
    let last = centered.findLastIndex(value => Math.abs(value) > threshold);
    first = Math.max(0, first - Math.round(sampleRate * .003));
    last = Math.min(centered.length - 1, last + Math.round(sampleRate * .025));
    const samples = centered.slice(first, last + 1);
    const fadeIn = Math.round(sampleRate * .002);
    const fadeOut = Math.round(sampleRate * .012);
    for (let i = 0; i < samples.length; i++) {
      samples[i] *= Math.min(1, i / fadeIn, (samples.length - 1 - i) / fadeOut);
    }
    const peak = Math.max(...samples.map(Math.abs));
    const gain = 10 ** (-6 / 20) / peak;
    for (let i = 0; i < samples.length; i++) samples[i] *= gain;
    const wav = Buffer.alloc(44 + samples.length * 2);
    wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
    wav.writeUInt32LE(samples.length * 2, 40);
    samples.forEach((value, i) => wav.writeInt16LE(Math.round(value * 32767), 44 + i * 2));
    await writeFile(new URL(output, outputDir), wav);
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    report.push({ output, source: file, sourceSha256: createHash('sha256').update(input).digest('hex'),
      sourceChannels: channels, originalDuration: raw.length / sampleRate,
      trimStartSeconds: first / sampleRate, duration: samples.length / sampleRate,
      sampleRate, channels: 1, bits: 16, peakDbFS: -6, rmsDbFS: 20 * Math.log10(rms), bytes: wav.length,
      sha256: createHash('sha256').update(wav).digest('hex') });
  }
} finally { await browser.close(); }
await writeFile(new URL('./footsteps-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.map(({output,duration,rmsDbFS,bytes}) => ({output,duration,rmsDbFS,bytes})), null, 2));
