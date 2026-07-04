import { Jimp } from 'jimp';
import pngToIco from 'png-to-ico';
import fs from 'fs';

async function processLogo() {
  try {
    // Read the image
    const image = await Jimp.read('public/logo.png');
    
    // Resize to 256x256 and pad with transparency (contain)
    await image.contain({ w: 256, h: 256 });
    
    // Save the squared version
    await image.write('public/logo_square.png');
    console.log('Created logo_square.png');
    
    // Convert to ICO
    const buf = await pngToIco('public/logo_square.png');
    fs.writeFileSync('public/icon.ico', buf);
    console.log('Successfully created public/icon.ico');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

processLogo();
