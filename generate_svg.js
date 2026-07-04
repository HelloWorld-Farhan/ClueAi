import fs from 'fs';

try {
  // Read the original logo
  const logoBuffer = fs.readFileSync('public/logo.png');
  const base64Logo = logoBuffer.toString('base64');
  const size = 120;
  const radius = 24;

  // Create SVG with base64 image and clipPath
  const svgContent = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="roundCorner">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" />
    </clipPath>
  </defs>
  <image href="data:image/png;base64,${base64Logo}" width="${size}" height="${size}" clip-path="url(#roundCorner)" />
</svg>`;

  fs.writeFileSync('public/logo_rounded.svg', svgContent);
  console.log('Successfully created public/logo_rounded.svg');
} catch (err) {
  console.error(err);
}
