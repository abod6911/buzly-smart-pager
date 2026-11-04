const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(size, filename) {
  const width = size;
  const height = size;

  // Raw RGBA buffer
  const buffer = Buffer.alloc(height * (1 + width * 4));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    buffer[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Distance from center
      const cx = width / 2;
      const cy = height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = width * 0.44;

      if (dist < radius) {
        // Inner circle: Emerald gradient
        const t = (y / height);
        buffer[pxOffset] = Math.floor(16 + t * 10);      // R
        buffer[pxOffset + 1] = Math.floor(185 - t * 20); // G (#10B981)
        buffer[pxOffset + 2] = Math.floor(129 - t * 30); // B
        buffer[pxOffset + 3] = 255;                      // Alpha
      } else {
        // Background: Obsidian #0A0A0C
        buffer[pxOffset] = 10;
        buffer[pxOffset + 1] = 10;
        buffer[pxOffset + 2] = 12;
        buffer[pxOffset + 3] = 255;
      }
    }
  }

  // Deflate image data
  const compressedData = zlib.deflateSync(buffer);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type);
    const body = Buffer.concat([typeBuf, data]);

    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(calcCrc(body), 0);

    return Buffer.concat([len, body, crc]);
  }

  function calcCrc(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);

  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(path.join(publicDir, filename), png);
  console.log(`Generated ${filename}`);
}

createPng(192, 'icon-192.png');
createPng(512, 'icon-512.png');
createPng(192, 'apple-touch-icon.png');
