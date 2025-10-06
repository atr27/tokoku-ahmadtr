import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// Placeholder image URLs from Unsplash (free to use)
const drinkImages: Record<string, string> = {
  'espresso.jpg': 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&h=400&fit=crop',
  'cappuccino.jpg': 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=400&fit=crop',
  'latte.jpg': 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=400&h=400&fit=crop',
  'americano.jpg': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&h=400&fit=crop',
  'mocha.jpg': 'https://images.unsplash.com/photo-1607260550778-aa9d29444ce1?w=400&h=400&fit=crop',
  'caramel-macchiato.jpg': 'https://images.unsplash.com/photo-1599639957043-f3aa5c986398?w=400&h=400&fit=crop',
  'iced-coffee.jpg': 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400&h=400&fit=crop',
  'vietnamese-coffee.jpg': 'https://images.unsplash.com/photo-1599639957043-f3aa5c986398?w=400&h=400&fit=crop',
  'english-breakfast.jpg': 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&h=400&fit=crop',
  'green-tea.jpg': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop',
  'jasmine-tea.jpg': 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=400&h=400&fit=crop',
  'earl-grey.jpg': 'https://images.unsplash.com/photo-1597318130878-4e6d3e3b4b3f?w=400&h=400&fit=crop',
  'chamomile.jpg': 'https://images.unsplash.com/photo-1597318130878-4e6d3e3b4b3f?w=400&h=400&fit=crop',
  'thai-tea.jpg': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&h=400&fit=crop',
  'matcha-latte.jpg': 'https://images.unsplash.com/photo-1536013564-8f8c00e8e2f3?w=400&h=400&fit=crop',
  'iced-lemon-tea.jpg': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop',
  'orange-juice.jpg': 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&h=400&fit=crop',
  'mango-smoothie.jpg': 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=400&fit=crop',
  'strawberry-banana.jpg': 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=400&fit=crop',
  'green-detox.jpg': 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=400&fit=crop',
  'watermelon-juice.jpg': 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&h=400&fit=crop',
  'avocado-smoothie.jpg': 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400&h=400&fit=crop',
  'mixed-berry.jpg': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&h=400&fit=crop',
  'carrot-ginger.jpg': 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400&h=400&fit=crop',
  'coconut-water.jpg': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&h=400&fit=crop',
  'lemonade.jpg': 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9d?w=400&h=400&fit=crop',
  'iced-chocolate.jpg': 'https://images.unsplash.com/photo-1542990253-a781e04c0082?w=400&h=400&fit=crop',
  'mineral-water.jpg': 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=400&fit=crop',
  'sparkling-water.jpg': 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=400&h=400&fit=crop',
  'hot-chocolate.jpg': 'https://images.unsplash.com/photo-1517578239113-b03992dcdd25?w=400&h=400&fit=crop',
  'vanilla-milkshake.jpg': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=400&fit=crop',
  'chocolate-milkshake.jpg': 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&h=400&fit=crop',
};

const downloadImage = (url: string, filepath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(filepath);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
      } else if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirect
        if (response.headers.location) {
          downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
        } else {
          reject(new Error(`Redirect without location for ${url}`));
        }
      } else {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
};

async function main() {
  const publicDir = path.join(process.cwd(), 'public', 'drinks');
  
  // Ensure directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  console.log('🖼️  Downloading drink images...');
  
  let downloaded = 0;
  let skipped = 0;

  for (const [filename, url] of Object.entries(drinkImages)) {
    const filepath = path.join(publicDir, filename);
    
    // Skip if file already exists
    if (fs.existsSync(filepath)) {
      console.log(`⏭️  Skipping ${filename} (already exists)`);
      skipped++;
      continue;
    }

    try {
      await downloadImage(url, filepath);
      console.log(`✅ Downloaded ${filename}`);
      downloaded++;
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`❌ Failed to download ${filename}:`, error);
    }
  }

  console.log(`\n✨ Download complete!`);
  console.log(`   Downloaded: ${downloaded}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${Object.keys(drinkImages).length}`);
}

main().catch(console.error);
