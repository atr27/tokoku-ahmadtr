// TheMealDB API integration
const MEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';
const COFFEE_API_BASE_URL = 'https://api.sampleapis.com/coffee';

export interface MealDBMeal {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strMealThumb: string;
  strTags: string | null;
  strYoutube: string;
  [key: string]: string | null;
}

export interface MealDBCategory {
  idCategory: string;
  strCategory: string;
  strCategoryThumb: string;
  strCategoryDescription: string;
}

export interface CoffeeItem {
  id: number | string;
  title: string;
  description: string;
  ingredients: string[];
  image: string;
}

/**
 * Fetch all meal categories from TheMealDB
 */
export async function fetchMealCategories(): Promise<MealDBCategory[]> {
  try {
    const response = await fetch(`${MEALDB_BASE_URL}/categories.php`);
    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }
    const data = await response.json();
    return data.categories || [];
  } catch (error) {
    console.error('Error fetching meal categories:', error);
    return [];
  }
}

/**
 * Fetch meals by category
 */
export async function fetchMealsByCategory(category: string): Promise<MealDBMeal[]> {
  try {
    const response = await fetch(`${MEALDB_BASE_URL}/filter.php?c=${category}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch meals for category: ${category}`);
    }
    const data = await response.json();
    return data.meals || [];
  } catch (error) {
    console.error(`Error fetching meals for category ${category}:`, error);
    return [];
  }
}

/**
 * Fetch full meal details by ID
 */
export async function fetchMealById(id: string): Promise<MealDBMeal | null> {
  try {
    const response = await fetch(`${MEALDB_BASE_URL}/lookup.php?i=${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch meal with ID: ${id}`);
    }
    const data = await response.json();
    return data.meals?.[0] || null;
  } catch (error) {
    console.error(`Error fetching meal with ID ${id}:`, error);
    return null;
  }
}

/**
 * Fetch random meals
 */
export async function fetchRandomMeals(count: number = 10): Promise<MealDBMeal[]> {
  try {
    const promises = Array.from({ length: count }, () =>
      fetch(`${MEALDB_BASE_URL}/random.php`).then(res => res.json())
    );
    const results = await Promise.all(promises);
    return results.map(data => data.meals?.[0]).filter(Boolean);
  } catch (error) {
    console.error('Error fetching random meals:', error);
    return [];
  }
}

/**
 * Search meals by name
 */
export async function searchMealsByName(name: string): Promise<MealDBMeal[]> {
  try {
    const response = await fetch(`${MEALDB_BASE_URL}/search.php?s=${name}`);
    if (!response.ok) {
      throw new Error(`Failed to search meals with name: ${name}`);
    }
    const data = await response.json();
    return data.meals || [];
  } catch (error) {
    console.error(`Error searching meals with name ${name}:`, error);
    return [];
  }
}

/**
 * Fetch hot coffee drinks from Coffee API
 */
export async function fetchHotCoffee(): Promise<CoffeeItem[]> {
  try {
    const response = await fetch(`${COFFEE_API_BASE_URL}/hot`);
    if (!response.ok) {
      throw new Error('Failed to fetch hot coffee');
    }
    const data = await response.json();
    // Filter out invalid entries and limit to 15 items
    return data
      .filter((item: CoffeeItem) => 
        item.title && 
        item.description && 
        item.image && 
        item.image.startsWith('http') &&
        typeof item.id !== 'string' // Remove test entries
      )
      .slice(0, 15);
  } catch (error) {
    console.error('Error fetching hot coffee:', error);
    return [];
  }
}

/**
 * Fetch iced coffee drinks from Coffee API
 */
export async function fetchIcedCoffee(): Promise<CoffeeItem[]> {
  try {
    const response = await fetch(`${COFFEE_API_BASE_URL}/iced`);
    if (!response.ok) {
      throw new Error('Failed to fetch iced coffee');
    }
    const data = await response.json();
    return data.filter((item: CoffeeItem) => 
      item.title && 
      item.description && 
      item.image && 
      item.image.startsWith('http')
    );
  } catch (error) {
    console.error('Error fetching iced coffee:', error);
    return [];
  }
}

/**
 * Fetch all coffee drinks (hot + iced)
 */
export async function fetchAllCoffee(): Promise<CoffeeItem[]> {
  try {
    const [hot, iced] = await Promise.all([
      fetchHotCoffee(),
      fetchIcedCoffee()
    ]);
    return [...hot, ...iced];
  } catch (error) {
    console.error('Error fetching all coffee:', error);
    return [];
  }
}

/**
 * Fetch meals for seeding - gets a variety of meals from different categories
 */
export async function fetchMealsForSeeding(): Promise<{
  categories: MealDBCategory[];
  meals: Map<string, MealDBMeal[]>;
}> {
  try {
    // Fetch all categories
    const categories = await fetchMealCategories();
    
    // Select specific categories for food and beverages
    const selectedCategories = categories.filter(cat => 
      ['Beef', 'Chicken', 'Dessert', 'Pasta', 'Seafood', 'Vegetarian', 'Breakfast'].includes(cat.strCategory)
    );

    // Fetch meals for each selected category (limit to 5 per category)
    const mealsMap = new Map<string, MealDBMeal[]>();
    
    for (const category of selectedCategories) {
      const categoryMeals = await fetchMealsByCategory(category.strCategory);
      // Get detailed info for first 5 meals
      const detailedMeals = await Promise.all(
        categoryMeals.slice(0, 5).map(meal => fetchMealById(meal.idMeal))
      );
      mealsMap.set(
        category.strCategory,
        detailedMeals.filter((meal): meal is MealDBMeal => meal !== null)
      );
    }

    return { categories: selectedCategories, meals: mealsMap };
  } catch (error) {
    console.error('Error fetching meals for seeding:', error);
    return { categories: [], meals: new Map() };
  }
}
