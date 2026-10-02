/**
 * PCM AudioWorklet Processor
 *
 * Runs inside the AudioContext at 16 kHz (we create the context with
 * { sampleRate: 16000 } so no downsampling is needed here).
 *
 * Each process() call delivers 128 Float32 samples (= 8 ms @ 16 kHz).
 * We accumulate samples into a ring buffer and emit 1600-sample chunks
 * (100 ms) as transferable Int16 ArrayBuffers to the main thread.
 */
class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._buf          = new Int16Array(0);
        this._chunkSamples = 1600; // 100 ms @ 16 kHz
    }

    process(inputs) {
        const ch = inputs[0]?.[0];
        if (!ch || ch.length === 0) return true;

        // Float32 → Int16
        const int16 = new Int16Array(ch.length);
        for (let i = 0; i < ch.length; i++) {
            const s  = Math.max(-1, Math.min(1, ch[i]));
            int16[i] = s < 0 ? s * 32768 : s * 32767;
        }

        // Append to buffer
        const merged = new Int16Array(this._buf.length + int16.length);
        merged.set(this._buf);
        merged.set(int16, this._buf.length);
        this._buf = merged;

        // Emit complete 100 ms chunks
        while (this._buf.length >= this._chunkSamples) {
            const chunk  = this._buf.slice(0, this._chunkSamples);
            this._buf    = this._buf.slice(this._chunkSamples);
            // Transfer the underlying ArrayBuffer (zero-copy)
            this.port.postMessage(chunk.buffer, [chunk.buffer]);
        }

        return true; // keep processor alive
    }
}

registerProcessor('pcm-processor', PCMProcessor);
