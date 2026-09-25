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
  if (e.button === 2) {
    // Right click -> cancel
    ipcRenderer.send('snip-cancel');
    return;
  }
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

  // Max dimension limit for faster AI processing (e.g., max 1280px)
  const MAX_DIM = 1280;
  if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / targetWidth, MAX_DIM / targetHeight);
    targetWidth *= ratio;
    targetHeight *= ratio;
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(targetWidth);
  canvas.height = Math.round(targetHeight);
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    screenImage, 
    left * scaleX, top * scaleY, width * scaleX, height * scaleY, // Source
    0, 0, canvas.width, canvas.height // Destination
  );
  
  // High quality JPEG for best AI analysis
  const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  
  // Send back
  ipcRenderer.send('snip-complete', croppedDataUrl);
});

// ESC key cancellation - critical for snipping window to close cleanly
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ipcRenderer.send('snip-cancel');
  }
});

window.addEventListener('contextmenu', e => e.preventDefault());
