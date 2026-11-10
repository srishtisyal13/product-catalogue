import type { Category, Product } from "@catalogue/shared";

const mens: Category = { slug: "mens-clothing", name: "men's clothing" };
const electronics: Category = { slug: "electronics", name: "electronics" };

function product(id: string, title: string, category: Category, rate: number): Product {
  return {
    id,
    title,
    description: `${title} description`,
    price: { amount: 10 + Number(id), currency: "USD" },
    category,
    imageUrl: `https://images.example.com/${id}.jpg`,
    rating: { rate, count: 100 },
  };
}

export const categories: Category[] = [electronics, mens];

export const products: Product[] = [
  product("1", "Hiking Backpack", mens, 3.9),
  product("2", "Mens Slim Fit Jacket", mens, 4.1),
  product("3", "Mens Cotton T-Shirt", mens, 4.7),
  product("4", "Portable SSD", electronics, 4.8),
  product("5", "Gaming Monitor", electronics, 2.2),
  product("6", "Wireless Mouse", electronics, 4.0),
  product("7", "Leather Jacket", mens, 3.5),
];

export const featured = ["4", "1", "3", "6", "2"].map((id) => products.find((p) => p.id === id)!);
