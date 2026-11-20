const formats = new Map([
  ["image/png", (bytes: Uint8Array) =>
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, i) => bytes[i] === value)],
  ["image/jpeg", (bytes: Uint8Array) =>
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff],
  ["image/gif", (bytes: Uint8Array) =>
    ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))],
  ["image/webp", (bytes: Uint8Array) =>
    ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP"],
  ["image/avif", (bytes: Uint8Array) => {
    if (bytes.length < 16 || ascii(bytes, 4, 8) !== "ftyp") return false;
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    const isAvifBrand = (start: number) =>
      ["avif", "avis"].includes(ascii(bytes, start, start + 4));
    if (size < 16) return false;
    if (isAvifBrand(8)) return true;
    for (let offset = 16; offset + 4 <= Math.min(size, bytes.length); offset += 4) {
      if (isAvifBrand(offset)) return true;
    }
    return false;
  }],
]);

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

export function isCmsImageType(contentType: string) {
  return formats.has(contentType);
}

export async function matchesCmsImageType(file: Blob) {
  const matches = formats.get(file.type);
  if (!matches) return false;
  return matches(new Uint8Array(await file.slice(0, 128).arrayBuffer()));
}
