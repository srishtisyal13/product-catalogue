import { NavLink } from "react-router";
import { useCategories } from "../api/queries";

export function CategoryNav() {
  const { data: categories } = useCategories();
  // The nav is secondary: if categories fail to load, the page still works without it.
  if (!categories || categories.length === 0) return null;

  return (
    <nav aria-label="Categories" className="category-nav">
      <ul className="container category-nav__list">
        {categories.map((category) => (
          <li key={category.slug}>
            <NavLink to={`/categories/${category.slug}`} className="category-nav__link">
              {category.name}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
