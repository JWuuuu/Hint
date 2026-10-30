import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Synthetic audio for the voice suite. Chromium plays `microphoneWav` as the
 * fake microphone; `replyWav` stands in for the API's spoken reply.
 */
function wav(rate: number, samples: number[]): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), index * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function microphone(): Buffer {
  const rate = 48000;
  const samples: number[] = [];
  let seed = 3;
  const noise = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed / 2147483648 - 0.5) * 0.004; };
  const silence = (seconds: number) => { for (let i = 0; i < rate * seconds; i += 1) samples.push(noise()); };
  // 0.6 s room tone, 1.8 s of syllable-shaped voiced sound, then a pause that ends the turn.
  silence(0.6);
  for (let i = 0; i < rate * 1.8; i += 1) {
    const t = i / rate;
    const syllable = 0.55 + 0.45 * Math.sin(2 * Math.PI * 3.2 * t);
    const tone = [180, 360, 540, 900].reduce((sum, frequency, k) => sum + Math.sin(2 * Math.PI * frequency * t) / (k + 1), 0);
    samples.push((0.22 * syllable * tone) / 2.1);
  }
  silence(4);
  return wav(rate, samples);
}

function reply(): Buffer {
  const rate = 24000;
  return wav(rate, Array.from({ length: rate * 1.2 }, (_, i) => 0.2 * Math.sin((2 * Math.PI * 440 * i) / rate)));
}

const directory = join(tmpdir(), "hint-voice-e2e");
mkdirSync(directory, { recursive: true });
export const microphoneWav = join(directory, "microphone.wav");
export const replyWav = join(directory, "reply.wav");
writeFileSync(microphoneWav, microphone());
writeFileSync(replyWav, reply());
