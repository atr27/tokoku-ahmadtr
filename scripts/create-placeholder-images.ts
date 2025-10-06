import * as fs from 'fs';
import * as path from 'path';

// Simple function to create a placeholder SVG image
function createPlaceholderSVG(name: string, color: string): string {
  return `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="400" fill="${color}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">
    ${name}
  </text>
</svg>`;
}

const drinkImages: Record<string, { name: string; color: string }> = {
  'espresso.jpg': { name: 'Espresso', color: '#3E2723' },
  'cappuccino.jpg': { name: 'Cappuccino', color: '#5D4037' },
  'latte.jpg': { name: 'Latte', color: '#6D4C41' },
  'americano.jpg': { name: 'Americano', color: '#4E342E' },
  'mocha.jpg': { name: 'Mocha', color: '#4A2C2A' },
  'caramel-macchiato.jpg': { name: 'Caramel Macchiato', color: '#8D6E63' },
  'iced-coffee.jpg': { name: 'Iced Coffee', color: '#795548' },
  'vietnamese-coffee.jpg': { name: 'Vietnamese Coffee', color: '#3E2723' },
  'english-breakfast.jpg': { name: 'English Breakfast', color: '#8B4513' },
  'green-tea.jpg': { name: 'Green Tea', color: '#4CAF50' },
  'jasmine-tea.jpg': { name: 'Jasmine Tea', color: '#66BB6A' },
  'earl-grey.jpg': { name: 'Earl Grey', color: '#A0522D' },
  'chamomile.jpg': { name: 'Chamomile', color: '#FFD54F' },
  'thai-tea.jpg': { name: 'Thai Tea', color: '#FF6F00' },
  'matcha-latte.jpg': { name: 'Matcha Latte', color: '#689F38' },
  'iced-lemon-tea.jpg': { name: 'Iced Lemon Tea', color: '#FDD835' },
  'orange-juice.jpg': { name: 'Orange Juice', color: '#FF9800' },
  'mango-smoothie.jpg': { name: 'Mango Smoothie', color: '#FFC107' },
  'strawberry-banana.jpg': { name: 'Strawberry Banana', color: '#E91E63' },
  'green-detox.jpg': { name: 'Green Detox', color: '#8BC34A' },
  'watermelon-juice.jpg': { name: 'Watermelon Juice', color: '#F44336' },
  'avocado-smoothie.jpg': { name: 'Avocado Smoothie', color: '#7CB342' },
  'mixed-berry.jpg': { name: 'Mixed Berry', color: '#9C27B0' },
  'carrot-ginger.jpg': { name: 'Carrot Ginger', color: '#FF5722' },
  'coconut-water.jpg': { name: 'Coconut Water', color: '#E0F2F1' },
  'lemonade.jpg': { name: 'Lemonade', color: '#FFEB3B' },
  'iced-chocolate.jpg': { name: 'Iced Chocolate', color: '#5D4037' },
  'mineral-water.jpg': { name: 'Mineral Water', color: '#B3E5FC' },
  'sparkling-water.jpg': { name: 'Sparkling Water', color: '#81D4FA' },
  'hot-chocolate.jpg': { name: 'Hot Chocolate', color: '#6D4C41' },
  'vanilla-milkshake.jpg': { name: 'Vanilla Milkshake', color: '#FFF9C4' },
  'chocolate-milkshake.jpg': { name: 'Chocolate Milkshake', color: '#795548' },
};

async function main() {
  const publicDir = path.join(process.cwd(), 'public', 'drinks');
  
  // Ensure directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  console.log('🖼️  Creating placeholder drink images...');
  
  let created = 0;
  let skipped = 0;

  for (const [filename, { name, color }] of Object.entries(drinkImages)) {
    const filepath = path.join(publicDir, filename.replace('.jpg', '.svg'));
    
    // Skip if file already exists
    if (fs.existsSync(filepath)) {
      console.log(`⏭️  Skipping ${filename} (already exists)`);
      skipped++;
      continue;
    }

    try {
      const svg = createPlaceholderSVG(name, color);
      fs.writeFileSync(filepath, svg);
      console.log(`✅ Created ${filename.replace('.jpg', '.svg')}`);
      created++;
    } catch (error) {
      console.error(`❌ Failed to create ${filename}:`, error);
    }
  }

  console.log(`\n✨ Creation complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${Object.keys(drinkImages).length}`);
}

main().catch(console.error);
