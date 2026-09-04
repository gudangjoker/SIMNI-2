import { strict as assert } from 'node:assert';
import {
    downsampleMono,
    encodeMonoPcm16Wav,
    inferAudioMime
} from '../chat/js/chat-platform.js';

let passed = 0;

function verify(condition, message) {
    assert.equal(Boolean(condition), true, message);
    passed += 1;
    console.log(`[PASS] ${message}`);
}

function textAt(view, offset, length) {
    return String.fromCharCode(...new Uint8Array(view.buffer, offset, length));
}

console.log('\nSIMNI CHAT AUDIO REGRESSION\n');

const sourceRate = 48000;
const targetRate = 16000;
const source = new Float32Array(sourceRate);
for (let index = 0; index < source.length; index += 1) {
    source[index] = Math.sin((2 * Math.PI * 440 * index) / sourceRate) * 0.5;
}

const downsampled = downsampleMono(source, sourceRate, targetRate);
verify(downsampled.length === targetRate, 'Downsampling 48 kHz ke 16 kHz menghasilkan tepat satu detik audio');
verify(downsampled.every((sample) => Number.isFinite(sample) && sample >= -1 && sample <= 1), 'Seluruh sampel hasil downsampling valid');

const wav = encodeMonoPcm16Wav(downsampled, targetRate);
const view = new DataView(wav);
verify(textAt(view, 0, 4) === 'RIFF', 'Header WAV memiliki penanda RIFF');
verify(textAt(view, 8, 4) === 'WAVE', 'Header WAV memiliki format WAVE');
verify(textAt(view, 12, 4) === 'fmt ', 'Header WAV memiliki blok fmt');
verify(textAt(view, 36, 4) === 'data', 'Header WAV memiliki blok data');
verify(view.getUint16(20, true) === 1, 'WAV menggunakan PCM linear');
verify(view.getUint16(22, true) === 1, 'WAV menggunakan satu kanal mono');
verify(view.getUint32(24, true) === targetRate, 'WAV menggunakan sample rate 16 kHz');
verify(view.getUint16(34, true) === 16, 'WAV menggunakan kedalaman 16-bit');
verify(wav.byteLength === 44 + (targetRate * 2), 'Ukuran WAV sesuai jumlah sampel PCM');

const expectedMimes = new Map([
    [['audio/wav', 'voice.bin'], 'audio/wav'],
    [['', 'voice.mp3'], 'audio/mpeg'],
    [['application/octet-stream', 'voice.m4a'], 'audio/mp4'],
    [['', 'voice.ogg'], 'audio/ogg'],
    [['', 'voice.webm'], 'audio/webm']
]);
for (const [[mime, filename], expected] of expectedMimes) {
    verify(inferAudioMime(mime, filename) === expected, `MIME ${filename} dinormalisasi menjadi ${expected}`);
}

const maximumVoiceBytes = 44 + (120 * targetRate * 2);
verify(maximumVoiceBytes < (8 * 1024 * 1024), 'Voice note WAV 120 detik tetap di bawah batas unggah 8 MiB');

console.log(`\nCHAT AUDIO REGRESSION: ${passed} PASS, 0 FAIL`);
