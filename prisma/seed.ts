import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { fetchMealsForSeeding } from '../src/lib/themealdb';
import { drinksData } from './drinks-data';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await prisma.inventoryLog.deleteMany();
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  console.log('👥 Creating users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@nextpos.com',
      password: hashedPassword,
      name: 'Admin User',
      role: UserRole.ADMIN,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@nextpos.com',
      password: hashedPassword,
      name: 'Manager User',
      role: UserRole.MANAGER,
    },
  });

  const cashier = await prisma.user.create({
    data: {
      email: 'cashier@nextpos.com',
      password: hashedPassword,
      name: 'Cashier User',
      role: UserRole.CASHIER,
    },
  });

  console.log(`✅ Created ${3} users`);

  // Fetch data from TheMealDB
  console.log('🌐 Fetching data from TheMealDB API...');
  const { categories: mealCategories, meals: mealsMap } = await fetchMealsForSeeding();
  console.log(`✅ Fetched ${mealCategories.length} categories from TheMealDB`);

  // Create Categories from TheMealDB
  console.log('📁 Creating categories...');
  const categoryMap = new Map<string, any>();
  
  for (const mealCategory of mealCategories) {
    const category = await prisma.category.create({
      data: {
        name: mealCategory.strCategory,
        description: mealCategory.strCategoryDescription.substring(0, 200), // Limit description length
      },
    });
    categoryMap.set(mealCategory.strCategory, category);
  }

  console.log(`✅ Created ${categoryMap.size} categories`);

  // Create Products from TheMealDB
  console.log('📦 Creating products from TheMealDB...');
  const products = [];
  let productCounter = 0;

  for (const [categoryName, meals] of mealsMap.entries()) {
    const category = categoryMap.get(categoryName);
    if (!category) continue;

    for (const meal of meals) {
      productCounter++;
      // Generate SKU from category and meal ID
      const sku = `${categoryName.substring(0, 3).toUpperCase()}-${meal.idMeal}`;
      
      // Generate random but realistic prices based on category
      const basePrice = categoryName === 'Dessert' ? 35000 : 
                       categoryName === 'Seafood' ? 85000 :
                       categoryName === 'Beef' ? 75000 :
                       categoryName === 'Chicken' ? 55000 :
                       categoryName === 'Pasta' ? 45000 :
                       categoryName === 'Vegetarian' ? 40000 :
                       50000; // Breakfast and others
      
      const price = basePrice + Math.floor(Math.random() * 20000);
      const cost = Math.floor(price * 0.4); // 40% cost margin
      
      // Get first 200 chars of instructions as description
      const description = meal.strInstructions 
        ? meal.strInstructions.substring(0, 200) + '...'
        : `Delicious ${meal.strMeal} from ${meal.strArea || 'International'} cuisine`;

      const product = await prisma.product.create({
        data: {
          name: meal.strMeal,
          description: description,
          sku: sku,
          price: price,
          cost: cost,
          stock: Math.floor(Math.random() * 50) + 20, // Random stock between 20-70
          minStock: 5,
          categoryId: category.id,
          image: meal.strMealThumb,
          barcode: `890${meal.idMeal}`,
          isActive: true,
        },
      });
      
      products.push(product);
    }
  }

  console.log(`✅ Created ${products.length} products from TheMealDB`);

  // Create Drinks Categories and Products
  console.log('🍹 Creating drink categories and products...');
  
  // Get unique drink categories
  const drinkCategoryNames = [...new Set(drinksData.map(drink => drink.category))];
  const drinkCategoryMap = new Map<string, any>();
  
  // Create drink categories
  for (const categoryName of drinkCategoryNames) {
    let category = categoryMap.get(categoryName);
    
    // If category doesn't exist, create it
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: categoryName,
          description: `${categoryName} beverages and drinks`,
        },
      });
      categoryMap.set(categoryName, category);
      drinkCategoryMap.set(categoryName, category);
    } else {
      drinkCategoryMap.set(categoryName, category);
    }
  }
  
  console.log(`✅ Created/Found ${drinkCategoryMap.size} drink categories`);
  
  // Create drink products
  let drinkCounter = 0;
  for (const drink of drinksData) {
    drinkCounter++;
    const category = drinkCategoryMap.get(drink.category);
    if (!category) continue;
    
    // Generate SKU for drinks
    const sku = `DRK-${drink.category.substring(0, 3).toUpperCase()}-${String(drinkCounter).padStart(3, '0')}`;
    
    const product = await prisma.product.create({
      data: {
        name: drink.name,
        description: drink.description,
        sku: sku,
        price: drink.price,
        cost: drink.cost,
        stock: drink.stock,
        minStock: 10,
        categoryId: category.id,
        image: drink.image,
        barcode: `891${String(drinkCounter).padStart(6, '0')}`,
        isActive: true,
      },
    });
    
    products.push(product);
  }
  
  console.log(`✅ Created ${drinksData.length} drink products`);

  // Create sample inventory logs
  console.log('📊 Creating inventory logs...');
  const inventoryLogs = await Promise.all([
    prisma.inventoryLog.create({
      data: {
        productId: products[0].id,
        type: 'RESTOCK',
        quantity: 100,
        previousStock: 0,
        newStock: 100,
        reason: 'Initial stock',
        createdBy: admin.id,
      },
    }),
    prisma.inventoryLog.create({
      data: {
        productId: products[1].id,
        type: 'RESTOCK',
        quantity: 100,
        previousStock: 0,
        newStock: 100,
        reason: 'Initial stock',
        createdBy: admin.id,
      },
    }),
  ]);

  console.log(`✅ Created ${inventoryLogs.length} inventory logs`);

  console.log('✨ Seeding completed successfully!');
  console.log('\n📝 Default credentials:');
  console.log('   Admin: admin@nextpos.com / password123');
  console.log('   Manager: manager@nextpos.com / password123');
  console.log('   Cashier: cashier@nextpos.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
