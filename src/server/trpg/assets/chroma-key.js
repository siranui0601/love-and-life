import zlib from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const KEY_COLORS = Object.freeze({ green: [0, 255, 0], pink: [255, 0, 255] });
const MAX_INPUT_BYTES = 32 * 1024 * 1024;
const MAX_DIMENSION = 8192;
const MAX_PIXELS = 32_000_000;
const CRC_TABLE = makeCrcTable();

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function pngChunks(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("not_png");
  if (buffer.length > MAX_INPUT_BYTES) throw new Error("png_input_too_large");
  const chunks = [];
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    if (offset + length + 12 > buffer.length) throw new Error("invalid_png_chunk");
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) });
    offset += length + 12;
    if (type === "IEND") break;
  }
  return chunks;
}

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const diagonalDistance = Math.abs(estimate - upperLeft);
  return leftDistance <= upDistance && leftDistance <= diagonalDistance ? left : upDistance <= diagonalDistance ? up : upperLeft;
}

function unfilter(data, width, height, bytesPerPixel) {
  const stride = width * bytesPerPixel;
  const output = Buffer.alloc(stride * height);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = data[inputOffset++];
    const rowOffset = y * stride;
    const previousOffset = (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = data[inputOffset++];
      const left = x >= bytesPerPixel ? output[rowOffset + x - bytesPerPixel] : 0;
      const up = y ? output[previousOffset + x] : 0;
      const upperLeft = y && x >= bytesPerPixel ? output[previousOffset + x - bytesPerPixel] : 0;
      let value = raw;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) value += paeth(left, up, upperLeft);
      else if (filter !== 0) throw new Error(`unsupported_png_filter_${filter}`);
      output[rowOffset + x] = value & 255;
    }
  }
  return output;
}

export function decodePng(buffer) {
  const chunks = pngChunks(buffer);
  const header = chunks.find((entry) => entry.type === "IHDR")?.data;
  if (!header) throw new Error("png_ihdr_missing");
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
    throw new Error("png_dimensions_too_large");
  }
  const bitDepth = header[8];
  const colorType = header[9];
  const interlace = header[12];
  if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    throw new Error(`unsupported_png_${bitDepth}_${colorType}_${interlace}`);
  }
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const compressed = Buffer.concat(chunks.filter((entry) => entry.type === "IDAT").map((entry) => entry.data));
  const inflatedLength = (width * bytesPerPixel + 1) * height;
  const inflated = zlib.inflateSync(compressed, { maxOutputLength: inflatedLength });
  if (inflated.length !== inflatedLength) throw new Error("invalid_png_scanline_length");
  const pixels = unfilter(inflated, width, height, bytesPerPixel);
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const source = index * bytesPerPixel;
    const target = index * 4;
    rgba[target] = pixels[source];
    rgba[target + 1] = pixels[source + 1];
    rgba[target + 2] = pixels[source + 2];
    rgba[target + 3] = colorType === 6 ? pixels[source + 3] : 255;
  }
  return { width, height, rgba };
}

export function encodePng(width, height, rgba) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error("invalid_png_dimensions");
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) throw new Error("png_dimensions_too_large");
  if (!Buffer.isBuffer(rgba) || rgba.length !== width * height * 4) throw new Error("invalid_rgba_buffer");
  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);
    scanlines[row] = 0;
    rgba.copy(scanlines, row + 1, y * stride, y * stride + stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function colorDistance(red, green, blue, key) {
  return Math.max(Math.abs(red - key[0]), Math.abs(green - key[1]), Math.abs(blue - key[2]));
}

function keyDominance(red, green, blue, keyName) {
  return keyName === "pink" ? Math.min(red, blue) - green : green - Math.max(red, blue);
}

function matchesKey(red, green, blue, key, keyName, distanceLimit, dominanceLimit) {
  if (colorDistance(red, green, blue, key) <= distanceLimit) return true;
  const dominance = keyDominance(red, green, blue, keyName);
  return keyName === "pink"
    ? red > 105 && blue > 105 && dominance > dominanceLimit && green < 190
    : green > 105 && dominance > dominanceLimit && red < 190 && blue < 190;
}

function floodBackground(width, height, rgba, matchesBackground) {
  const mask = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let read = 0;
  let write = 0;
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (mask[index]) return;
    const pixel = index * 4;
    if (!matchesBackground(rgba[pixel], rgba[pixel + 1], rgba[pixel + 2])) return;
    mask[index] = 1;
    queue[write++] = index;
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  while (read < write) {
    const index = queue[read++];
    const x = index % width;
    const y = Math.floor(index / width);
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return mask;
}

function nearestBackgroundDistance(mask, width, height, x, y, radius) {
  for (let distance = 1; distance <= radius; distance += 1) {
    for (let dy = -distance; dy <= distance; dy += 1) {
      for (let dx = -distance; dx <= distance; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== distance) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[ny * width + nx]) return distance;
      }
    }
  }
  return null;
}

function removeSpill(red, green, blue, alpha, keyName) {
  if (!alpha) return [red, green, blue];
  if (keyName === "pink") {
    const excess = Math.max(0, Math.min(red, blue) - green);
    const cut = Math.min(96, excess) * (alpha < 240 ? 0.9 : 0.4);
    return [Math.max(0, Math.round(red - cut)), green, Math.max(0, Math.round(blue - cut))];
  }
  const excess = Math.max(0, green - Math.max(red, blue));
  const cut = Math.min(96, excess) * (alpha < 240 ? 0.9 : 0.4);
  return [red, Math.max(0, Math.round(green - cut)), blue];
}

export function chromaKeyPng(buffer, options = {}) {
  const keyName = options.keyColor === "pink" ? "pink" : "green";
  const key = KEY_COLORS[keyName];
  const backgroundDistance = Math.max(0, Number(options.backgroundDistance ?? 145));
  const edgeDistance = Math.max(backgroundDistance, Number(options.edgeDistance ?? 210));
  const featherRadius = Math.max(1, Math.min(8, Math.round(Number(options.featherRadius ?? 3))));
  const { width, height, rgba } = decodePng(buffer);
  const mask = floodBackground(width, height, rgba, (red, green, blue) => matchesKey(red, green, blue, key, keyName, backgroundDistance, 24));
  const output = Buffer.from(rgba);
  let transparentPixels = 0;
  let edgePixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const pixel = index * 4;
      if (mask[index]) {
        output[pixel + 3] = 0;
        transparentPixels += 1;
        continue;
      }
      const distance = nearestBackgroundDistance(mask, width, height, x, y, featherRadius);
      if (distance !== null && matchesKey(output[pixel], output[pixel + 1], output[pixel + 2], key, keyName, edgeDistance, 10)) {
        const featherAlpha = Math.round(255 * distance / (featherRadius + 1));
        output[pixel + 3] = Math.min(output[pixel + 3], featherAlpha);
        edgePixels += 1;
      }
      const [red, green, blue] = removeSpill(output[pixel], output[pixel + 1], output[pixel + 2], output[pixel + 3], keyName);
      output[pixel] = red;
      output[pixel + 1] = green;
      output[pixel + 2] = blue;
    }
  }
  return {
    buffer: encodePng(width, height, output),
    stats: {
      width,
      height,
      keyColor: keyName,
      transparentRatio: transparentPixels / (width * height),
      edgeRatio: edgePixels / (width * height),
      foregroundRatio: 1 - transparentPixels / (width * height),
    },
  };
}
