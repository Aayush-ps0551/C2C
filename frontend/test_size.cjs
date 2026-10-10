const fs = require('fs');
const sizeOf = require('image-size');
const path = 'c:/Users/aayus/Desktop/C2C/frontend/public/Modern tiles_Free/Characters_free/Adam_sit_16x16.png';

const dimensions = sizeOf(path);
console.log('Adam_sit_16x16.png size:', dimensions.width, 'x', dimensions.height);
