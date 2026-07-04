import sharp from 'sharp';
import fs from 'fs';

async function roundImage() {
  const size = 256;
  const radius = 64; // 25% border radius

  // Create SVG mask
  const roundedCorners = Buffer.from(
    `<svg><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}"/></svg>`
  );

  try {
    await sharp('public/logo.png')
      .resize(size, size)
      .composite([{
        input: roundedCorners,
        blend: 'dest-in'
      }])
      .png()
      .toFile('public/logo_rounded.png');
    console.log('Successfully created logo_rounded.png');
  } catch (err) {
    console.error('Error processing image:', err);
  }
}

roundImage();
