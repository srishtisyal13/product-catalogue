import { Link, Outlet, useSearchParams } from "react-router";
import { CategoryNav } from "./CategoryNav";
import { SearchBar } from "./SearchBar";

export function Layout() {
  const [params] = useSearchParams();
  const currentTerm = params.get("q") ?? "";

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand">
            Product Catalogue
          </Link>
          {/* Keyed by the URL term so the box resets when the search changes. */}
          <SearchBar key={currentTerm} initialTerm={currentTerm} />
        </div>
        <CategoryNav />
      </header>
      <main id="main" className="container site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container">Proof of concept. Product data from the Fake Store API.</div>
      </footer>
    </>
  );
}
