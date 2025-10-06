# Drinks Data Seeder

This directory contains the drinks data seeder that adds beverage products to your POS system database.

## Files

- **`drinks-data.ts`** - Contains the manual drink data with 36 different beverages across 4 categories
- **`seed.ts`** - Main seeding script that includes both meal and drink data
- **`../scripts/download-drink-images.ts`** - Script to download drink images from Unsplash

## Drink Categories

The seeder includes the following drink categories:

1. **Coffee** (8 items)
   - Espresso, Cappuccino, Caffe Latte, Americano, Mocha, Caramel Macchiato, Iced Coffee, Vietnamese Coffee

2. **Tea** (8 items)
   - English Breakfast Tea, Green Tea, Jasmine Tea, Earl Grey, Chamomile Tea, Thai Tea, Matcha Latte, Iced Lemon Tea

3. **Juice** (8 items)
   - Orange Juice, Mango Smoothie, Strawberry Banana Smoothie, Green Detox Juice, Watermelon Juice, Avocado Smoothie, Mixed Berry Smoothie, Carrot Ginger Juice

4. **Refreshments** (12 items)
   - Fresh Coconut Water, Lemonade, Iced Chocolate, Mineral Water, Sparkling Water, Hot Chocolate, Vanilla Milkshake, Chocolate Milkshake

## Usage

### Step 1: Download Drink Images

First, download the drink images from Unsplash:

```bash
npm run download:drinks
```

This will download all drink images to the `public/drinks/` directory.

### Step 2: Run the Seeder

Run the database seeder to populate the database with drinks (and meals):

```bash
npm run db:seed
```

Or using Prisma directly:

```bash
npx prisma db seed
```

## Data Structure

Each drink in `drinks-data.ts` has the following structure:

```typescript
{
  name: string;           // Drink name
  description: string;    // Drink description
  price: number;          // Selling price in IDR
  cost: number;           // Cost price in IDR
  stock: number;          // Initial stock quantity
  image: string;          // Image path (relative to public/)
  category: string;       // Category name
}
```

## Customization

### Adding New Drinks

To add new drinks, edit `prisma/drinks-data.ts`:

```typescript
export const drinksData: DrinkData[] = [
  // ... existing drinks
  {
    name: 'Your New Drink',
    description: 'Description of your drink',
    price: 30000,
    cost: 10000,
    stock: 50,
    image: '/drinks/your-drink.jpg',
    category: 'Coffee', // or create a new category
  },
];
```

### Adding New Categories

Simply add a drink with a new category name, and the seeder will automatically create the category:

```typescript
{
  name: 'Bubble Tea',
  description: 'Taiwanese milk tea with tapioca pearls',
  price: 35000,
  cost: 12000,
  stock: 60,
  image: '/drinks/bubble-tea.jpg',
  category: 'Specialty Drinks', // New category
}
```

### Changing Prices

Edit the `price` and `cost` fields in `drinks-data.ts` for any drink.

### Using Custom Images

1. Place your image in `public/drinks/`
2. Update the `image` field in `drinks-data.ts` to point to your image:
   ```typescript
   image: '/drinks/my-custom-image.jpg'
   ```

## Image Sources

The default images are sourced from Unsplash, which provides free-to-use images. The `download-drink-images.ts` script automatically downloads these images.

If you want to use your own images:
1. Place them in `public/drinks/`
2. Update the image paths in `drinks-data.ts`
3. Skip running `npm run download:drinks`

## SKU Format

Drinks use the following SKU format:
- `DRK-{CATEGORY_PREFIX}-{NUMBER}`
- Example: `DRK-COF-001` (Coffee), `DRK-TEA-009` (Tea)

## Barcode Format

Drinks use barcodes starting with `891`:
- Format: `891{6-digit-number}`
- Example: `891000001`, `891000002`, etc.

## Notes

- The seeder will clear all existing data before seeding
- All drinks are set to `isActive: true` by default
- Minimum stock is set to 10 for all drinks
- Stock levels are set in the drinks data file
- Images are stored in `public/drinks/` and served statically by Next.js

## Troubleshooting

### Images not downloading
- Check your internet connection
- Unsplash may rate limit requests - add delays between downloads
- Manually download images and place them in `public/drinks/`

### Seeding fails
- Ensure your database is running
- Check `.env` file has correct `DATABASE_URL`
- Run `npx prisma generate` to regenerate Prisma Client
- Check for duplicate SKUs or barcodes

### Images not showing in app
- Verify images exist in `public/drinks/`
- Check image paths in database match actual files
- Restart Next.js dev server to pick up new static files
