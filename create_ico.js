import pngToIco from 'png-to-ico';
import fs from 'fs';

pngToIco('public/logo.png')
  .then(buf => {
    fs.writeFileSync('public/icon.ico', buf);
    console.log('Successfully created icon.ico');
  })
  .catch(console.error);
