const nativeBridge = () => window.SIMNIPlatform || null;

function createPicker(accept, capture = null) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept || '';
    if (capture) input.capture = capture;
    input.hidden = true;
    document.body.appendChild(input);
    const cleanup = () => input.remove();
    input.addEventListener('change', () => {
      const file = input.files?.[0] || null;
      cleanup();
      if (file) resolve(file);
      else reject(Object.assign(new Error('Pemilihan file dibatalkan.'), { code: 'chat/file-pick-cancelled' }));
    }, { once: true });
    input.addEventListener('cancel', () => {
      cleanup();
      reject(Object.assign(new Error('Pemilihan file dibatalkan.'), { code: 'chat/file-pick-cancelled' }));
    }, { once: true });
    input.click();
  });
}

export function isNativePlatformAvailable() {
  return !!nativeBridge();
}

export async function pickImage() {
  const bridge = nativeBridge();
  if (bridge?.media?.pickImage) return bridge.media.pickImage();
  return createPicker('image/*');
}

export async function pickVideo() {
  const bridge = nativeBridge();
  if (bridge?.media?.pickVideo) return bridge.media.pickVideo();
  return createPicker('video/*');
}

export async function pickDocument() {
  const bridge = nativeBridge();
  if (bridge?.media?.pickFile) return bridge.media.pickFile();
  return createPicker('.pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf,text/plain');
}

export async function compressVideoNative(file, options) {
  const bridge = nativeBridge();
  if (!bridge?.media?.compressVideo) return null;
  return bridge.media.compressVideo(file, options);
}

export function downsampleMono(source, sourceRate, targetRate = 16000) {
  if (!(source instanceof Float32Array) || !source.length) throw new Error('Sampel audio tidak tersedia.');
  const fromRate = Number(sourceRate);
  const toRate = Number(targetRate);
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0 || toRate <= 0 || toRate > fromRate) {
    throw new Error('Sample rate audio tidak valid.');
  }
  if (fromRate === toRate) return new Float32Array(source);
  const ratio = fromRate / toRate;
  const outputLength = Math.max(1, Math.floor(source.length / ratio));
  const output = new Float32Array(outputLength);
  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.min(source.length, Math.max(start + 1, Math.floor((outputIndex + 1) * ratio)));
    let sum = 0;
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) sum += source[sourceIndex];
    output[outputIndex] = sum / (end - start);
  }
  return output;
}

export function encodeMonoPcm16Wav(samples, sampleRate = 16000) {
  if (!(samples instanceof Float32Array) || !samples.length) throw new Error('Sampel WAV tidak tersedia.');
  const rate = Number(sampleRate);
  if (!Number.isInteger(rate) || rate < 8000 || rate > 192000) throw new Error('Sample rate WAV tidak valid.');
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (const sample of samples) {
    const normalized = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, normalized < 0 ? normalized * 0x8000 : normalized * 0x7fff, true);
    offset += bytesPerSample;
  }
  return buffer;
}

function mergeAudioChunks(chunks, totalFrames) {
  const merged = new Float32Array(totalFrames);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function audioExtension(mime) {
  const value = String(mime || '').toLowerCase();
  if (value.includes('ogg')) return 'ogg';
  if (value.includes('mp4') || value.includes('aac')) return 'm4a';
  if (value.includes('mpeg')) return 'mp3';
  if (value.includes('wav')) return 'wav';
  return 'webm';
}

export function inferAudioMime(mime, filename = '') {
  const declared = String(mime || '').trim().toLowerCase();
  if (declared.startsWith('audio/')) return declared;
  const extension = String(filename || '').toLowerCase().split('.').pop();
  const byExtension = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    webm: 'audio/webm',
    aac: 'audio/aac'
  };
  return byExtension[extension] || 'audio/webm';
}

async function startWavRecording(stream, maxDurationMs) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio API tidak tersedia.');
  const context = new AudioContextClass({ latencyHint: 'interactive' });
  await context.resume();
  const sourceSampleRate = context.sampleRate;
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const mute = context.createGain();
  mute.gain.value = 0;
  const chunks = [];
  let totalFrames = 0;
  let settled = false;
  let timer = null;
  let resolveResult;
  let rejectResult;
  const result = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  processor.onaudioprocess = (event) => {
    if (settled) return;
    const channel = event.inputBuffer.getChannelData(0);
    const copy = new Float32Array(channel);
    chunks.push(copy);
    totalFrames += copy.length;
  };
  source.connect(processor);
  processor.connect(mute);
  mute.connect(context.destination);

  const finish = async (cancelled) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    processor.onaudioprocess = null;
    source.disconnect();
    processor.disconnect();
    mute.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    await context.close().catch(() => undefined);
    if (cancelled) {
      rejectResult(Object.assign(new Error('Perekaman dibatalkan.'), { code: 'chat/voice-cancelled' }));
      return;
    }
    if (!totalFrames) {
      rejectResult(new Error('Voice note kosong.'));
      return;
    }
    const merged = mergeAudioChunks(chunks, totalFrames);
    const downsampled = downsampleMono(merged, sourceSampleRate, 16000);
    const wav = encodeMonoPcm16Wav(downsampled, 16000);
    const blob = new Blob([wav], { type: 'audio/wav' });
    resolveResult(new File([blob], `voice-${Date.now()}.wav`, { type: 'audio/wav', lastModified: Date.now() }));
  };

  timer = setTimeout(() => void finish(false), Math.max(1000, Number(maxDurationMs) || 120000));
  return Object.freeze({
    result,
    stop() {
      void finish(false);
    },
    cancel() {
      void finish(true);
    }
  });
}

function startMediaRecorderRecording(stream, maxDurationMs) {
  const mimeCandidates = ['audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined);
  const chunks = [];
  let settled = false;
  let cancelled = false;
  let timer = null;
  let resolveResult;
  let rejectResult;
  const result = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const cleanup = () => {
    clearTimeout(timer);
    stream.getTracks().forEach((track) => track.stop());
  };
  const rejectOnce = (error) => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectResult(error);
  };
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data?.size) chunks.push(event.data);
  });
  recorder.addEventListener('error', (event) => rejectOnce(event.error || new Error('Perekaman suara gagal.')), { once: true });
  recorder.addEventListener('stop', () => {
    if (settled) return;
    cleanup();
    if (cancelled) {
      rejectOnce(Object.assign(new Error('Perekaman dibatalkan.'), { code: 'chat/voice-cancelled' }));
      return;
    }
    const actualMime = recorder.mimeType || mimeType || 'audio/webm';
    const blob = new Blob(chunks, { type: actualMime });
    if (!blob.size) {
      rejectOnce(new Error('Voice note kosong.'));
      return;
    }
    settled = true;
    resolveResult(new File([blob], `voice-${Date.now()}.${audioExtension(actualMime)}`, { type: actualMime, lastModified: Date.now() }));
  }, { once: true });
  recorder.start(500);
  timer = setTimeout(() => {
    if (recorder.state !== 'inactive') recorder.stop();
  }, Math.max(1000, Number(maxDurationMs) || 120000));
  return Object.freeze({
    result,
    stop() {
      if (recorder.state !== 'inactive') recorder.stop();
    },
    cancel() {
      cancelled = true;
      if (recorder.state !== 'inactive') recorder.stop();
      else rejectOnce(Object.assign(new Error('Perekaman dibatalkan.'), { code: 'chat/voice-cancelled' }));
    }
  });
}

export async function createPlayableAudioBlob(bytes, mime, filename = '') {
  const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (!payload.byteLength) throw new Error('Data pesan suara kosong.');
  const normalizedMime = inferAudioMime(mime, filename);
  const probe = document.createElement('audio');
  if (probe.canPlayType(normalizedMime) || normalizedMime === 'audio/wav') {
    return new Blob([payload], { type: normalizedMime });
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return new Blob([payload], { type: normalizedMime });
  const context = new AudioContextClass();
  try {
    const sourceBuffer = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
    const decoded = await context.decodeAudioData(sourceBuffer);
    const mono = new Float32Array(decoded.length);
    for (let channelIndex = 0; channelIndex < decoded.numberOfChannels; channelIndex += 1) {
      const channel = decoded.getChannelData(channelIndex);
      for (let index = 0; index < mono.length; index += 1) mono[index] += channel[index] / decoded.numberOfChannels;
    }
    const targetRate = Math.min(24000, decoded.sampleRate);
    const downsampled = downsampleMono(mono, decoded.sampleRate, targetRate);
    return new Blob([encodeMonoPcm16Wav(downsampled, targetRate)], { type: 'audio/wav' });
  } catch (_) {
    return new Blob([payload], { type: normalizedMime });
  } finally {
    await context.close().catch(() => undefined);
  }
}

export async function startVoiceRecording({ maxDurationMs = 120000 } = {}) {
  const bridge = nativeBridge();
  if (bridge?.media?.recordVoice) {
    let cancelled = false;
    const result = Promise.resolve(bridge.media.recordVoice({ maxDurationMs })).then((file) => {
      if (cancelled) throw Object.assign(new Error('Perekaman dibatalkan.'), { code: 'chat/voice-cancelled' });
      return file;
    });
    return Object.freeze({
      result,
      stop() {
        bridge.media.stopVoiceRecording?.();
      },
      cancel() {
        cancelled = true;
        bridge.media.cancelVoiceRecording?.();
      }
    });
  }
  const webAudioAvailable = !!(window.AudioContext || window.webkitAudioContext);
  if (!navigator.mediaDevices?.getUserMedia || (!webAudioAvailable && typeof MediaRecorder === 'undefined')) {
    throw Object.assign(new Error('Perekaman suara tidak didukung perangkat/browser ini.'), { code: 'chat/voice-not-supported' });
  }

  const constraints = { audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
  let stream = await navigator.mediaDevices.getUserMedia(constraints);
  if (webAudioAvailable) {
    try {
      return await startWavRecording(stream, maxDurationMs);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      if (typeof MediaRecorder === 'undefined') {
        throw Object.assign(
          new Error(`Perekam WAV gagal dimulai: ${error?.message || error}`),
          { code: 'chat/voice-recorder-failed', cause: error }
        );
      }
      console.warn('[SIMNI Chat] Recorder WAV tidak tersedia, memakai codec browser:', error);
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    }
  }
  return startMediaRecorderRecording(stream, maxDurationMs);
}

export function revokeObjectUrl(url) {
  if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
}
