import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SVG 아이콘 내용
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Background Circle -->
  <circle cx="256" cy="256" r="250" fill="#0066CC" stroke="#003366" stroke-width="12"/>
  
  <!-- BMW Style Ring (White) -->
  <circle cx="256" cy="256" r="200" fill="none" stroke="white" stroke-width="40"/>
  
  <!-- Center Circle for BMW Logo -->
  <circle cx="256" cy="256" r="160" fill="white"/>
  
  <!-- BMW Blue Quadrants -->
  <path d="M 256 96 A 160 160 0 0 1 416 256 L 256 256 Z" fill="#0066CC"/>
  <path d="M 96 256 A 160 160 0 0 1 256 96 L 256 256 Z" fill="#0066CC"/>
  
  <!-- Car Icon in Center -->
  <g transform="translate(256, 256)">
    <!-- Car Body -->
    <rect x="-60" y="-15" width="120" height="30" rx="8" fill="#333333" opacity="0.8"/>
    
    <!-- Car Windows -->
    <rect x="-40" y="-25" width="80" height="20" rx="6" fill="#333333" opacity="0.8"/>
    
    <!-- Wheels -->
    <circle cx="-35" cy="10" r="8" fill="#333333"/>
    <circle cx="35" cy="10" r="8" fill="#333333"/>
    
    <!-- Speed Lines -->
    <rect x="-90" y="-5" width="20" height="3" fill="#0066CC" opacity="0.7"/>
    <rect x="-90" y="0" width="15" height="3" fill="#0066CC" opacity="0.5"/>
    <rect x="-90" y="5" width="10" height="3" fill="#0066CC" opacity="0.3"/>
  </g>
  
  <!-- Monitor/Check Symbol -->
  <g transform="translate(380, 380)">
    <circle cx="0" cy="0" r="40" fill="#00CC66" stroke="white" stroke-width="4"/>
    <path d="M -15 0 L -5 10 L 15 -10" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
</svg>`;

const buildDir = path.join(__dirname, '..', 'build');

// build 디렉토리가 없으면 생성
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// PNG 생성 (모든 플랫폼용)
const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];

async function generateIcons() {
  console.log('Generating icons...');
  
  // 각 크기별 PNG 생성
  for (const size of sizes) {
    const outputPath = path.join(buildDir, `icon-${size}.png`);
    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Created ${outputPath}`);
  }
  
  // 메인 아이콘 파일 생성
  await sharp(Buffer.from(svgContent))
    .resize(512, 512)
    .png()
    .toFile(path.join(buildDir, 'icon.png'));
  console.log(`Created ${path.join(buildDir, 'icon.png')}`);
  
  // Windows용 ICO는 electron-builder가 자동으로 생성하므로 PNG만 준비
  // macOS용 ICNS도 electron-builder가 자동으로 생성
  
  console.log('Icon generation complete!');
}

generateIcons().catch(console.error);