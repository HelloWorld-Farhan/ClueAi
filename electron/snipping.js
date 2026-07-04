const { ipcRenderer } = require('electron');

let startX, startY;
let isDrawing = false;
let imageWidth, imageHeight;

const selectionBox = document.getElementById('selection-box');
const screenImage = document.getElementById('screen-image');

ipcRenderer.on('snip-image', (event, base64Image) => {
  screenImage.src = base64Image;
  screenImage.onload = () => {
    imageWidth = screenImage.naturalWidth;
    imageHeight = screenImage.naturalHeight;
  };
});

window.addEventListener('mousedown', (e) => {
  isDrawing = true;
  document.body.classList.add('drawing');
  startX = e.clientX;
  startY = e.clientY;
  
  selectionBox.style.display = 'block';
  selectionBox.style.left = startX + 'px';
  selectionBox.style.top = startY + 'px';
  selectionBox.style.width = '0px';
  selectionBox.style.height = '0px';
});

window.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;
  
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  
  selectionBox.style.left = left + 'px';
  selectionBox.style.top = top + 'px';
  selectionBox.style.width = width + 'px';
  selectionBox.style.height = height + 'px';
});

window.addEventListener('mouseup', (e) => {
  if (!isDrawing) return;
  isDrawing = false;
  
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  
  if (width < 10 || height < 10) {
    // Selection too small, cancel
    selectionBox.style.display = 'none';
    document.body.classList.remove('drawing');
    return;
  }
  
  // Crop image using canvas
  const scaleX = imageWidth / window.innerWidth;
  const scaleY = imageHeight / window.innerHeight;
  
  let targetWidth = width * scaleX;
  let targetHeight = height * scaleY;

  // Max dimension limit for faster AI processing (e.g., max 1024px)
  const MAX_DIM = 1024;
  if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / targetWidth, MAX_DIM / targetHeight);
    targetWidth *= ratio;
    targetHeight *= ratio;
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    screenImage, 
    left * scaleX, top * scaleY, width * scaleX, height * scaleY, // Source
    0, 0, canvas.width, canvas.height // Destination
  );
  
  // High compression for faster base64 transmission
  const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
  
  // Send back
  ipcRenderer.send('snip-complete', croppedDataUrl);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ipcRenderer.send('snip-cancel');
  }
});
