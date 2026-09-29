import sharp from 'sharp';
await sharp('public/social.svg').png().toFile('public/social.png');
