import sharp from "sharp";

export async function toWebp(input: Buffer, edge: number) {
  const image = sharp(input, { failOn: "none", animated: false }).rotate();
  const meta = await image.metadata();
  if (!meta.width || !meta.height) {
    throw new Error("No pudimos leer esa imagen.");
  }
  return image
    .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72, effort: 4 })
    .toBuffer();
}
