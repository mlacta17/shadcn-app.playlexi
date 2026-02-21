/**
 * PCM-to-WAV Encoder Utility
 *
 * Wispr Flow requires audio as base64-encoded WAV, not raw PCM.
 * This utility prepends the standard 44-byte RIFF/WAV header to raw PCM data
 * and optionally base64-encodes the result.
 */

/**
 * Prepend a 44-byte RIFF/WAV header to raw PCM (LINEAR16, mono) data.
 *
 * @param pcmBuffer - Raw PCM audio data (signed 16-bit LE, mono)
 * @param sampleRate - Sample rate in Hz (e.g. 16000)
 * @returns A Buffer containing valid WAV data
 */
export function pcmToWav(pcmBuffer: Buffer, sampleRate: number): Buffer {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcmBuffer.length
  const headerSize = 44
  const fileSize = headerSize + dataSize

  const header = Buffer.alloc(headerSize)

  // RIFF chunk descriptor
  header.write("RIFF", 0)
  header.writeUInt32LE(fileSize - 8, 4) // File size minus RIFF header
  header.write("WAVE", 8)

  // fmt sub-chunk
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16) // Sub-chunk size (16 for PCM)
  header.writeUInt16LE(1, 20) // Audio format (1 = PCM)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)

  // data sub-chunk
  header.write("data", 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcmBuffer])
}

/**
 * Convert raw PCM data to a base64-encoded WAV string.
 *
 * @param pcmBuffer - Raw PCM audio data (signed 16-bit LE, mono)
 * @param sampleRate - Sample rate in Hz (e.g. 16000)
 * @returns Base64-encoded WAV string
 */
export function pcmToBase64Wav(pcmBuffer: Buffer, sampleRate: number): string {
  return pcmToWav(pcmBuffer, sampleRate).toString("base64")
}
