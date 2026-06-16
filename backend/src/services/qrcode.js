const QRCode = require('qrcode');

async function generateQR(data) {
  return QRCode.toBuffer(String(data), { type: 'png', width: 200, margin: 1 });
}

async function generateQRDataURL(data) {
  return QRCode.toDataURL(String(data), { width: 200, margin: 1 });
}

module.exports = { generateQR, generateQRDataURL };
