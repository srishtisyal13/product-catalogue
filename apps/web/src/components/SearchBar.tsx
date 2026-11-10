import { SEARCH_SUGGEST_MIN_LENGTH, SEARCH_TERM_MAX_LENGTH } from "@catalogue/shared";
import { useState, type FocusEvent, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useSearchSuggestions } from "../api/queries";
import { formatPrice } from "../format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

/**
 * Wait this long after the last keystroke before asking the API.
 * Steady typing leaves roughly 150–300 ms between keys, so a 300 ms gap usually means
 * the person has paused, not that they're mid-word: one request per pause instead of
 * one per key. It's still short enough that suggestions appear within about half a
 * second of stopping. Tune with real usage data.
 */
export const SUGGEST_DEBOUNCE_MS = 300;
/** How many suggestions the dropdown shows. */
export const SUGGESTION_LIMIT = 5;

export function SearchBar({ initialTerm = "" }: { initialTerm?: string }) {
  const [term, setTerm] = useState(initialTerm);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const trimmed = term.trim();
  const debouncedTerm = useDebouncedValue(trimmed, SUGGEST_DEBOUNCE_MS);
  const longEnough = debouncedTerm.length >= SEARCH_SUGGEST_MIN_LENGTH;
  const suggestions = useSearchSuggestions(debouncedTerm, open && longEnough);
  const showPanel = open && longEnough && trimmed.length >= SEARCH_SUGGEST_MIN_LENGTH;

  function goToResults(searchTerm: string) {
    setOpen(false);
    navigate(`/search?${new URLSearchParams({ q: searchTerm })}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed) return;
    goToResults(trimmed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") setOpen(false);
  }

  // Close when focus leaves the search area (but not when moving into a suggestion).
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }

  const results = suggestions.data ?? [];

  return (
    <div className="search" onBlur={handleBlur}>
      <form role="search" className="search-bar" onSubmit={handleSubmit}>
        <label htmlFor="search-input" className="visually-hidden">
          Search products
        </label>
        <input
          id="search-input"
          type="search"
          name="q"
          placeholder="Search products"
          autoComplete="off"
          value={term}
          maxLength={SEARCH_TERM_MAX_LENGTH}
          aria-controls="search-suggestions"
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" className="button">
          Search
        </button>
      </form>

      {showPanel && (
        <div
          id="search-suggestions"
          className="search-suggestions"
          // Keep focus in the input while clicking a suggestion. Some browsers (Safari)
          // don't focus links on click, which would otherwise close the panel first.
          onMouseDown={(event) => event.preventDefault()}
        >
          {suggestions.isPending ? (
            <p role="status" className="search-suggestions__message">
              Searching…
            </p>
          ) : suggestions.isError ? (
            <p role="status" className="search-suggestions__message">
              Suggestions aren't available right now. Press Search to try again.
            </p>
          ) : results.length === 0 ? (
            <p role="status" className="search-suggestions__message">
              No products match “{debouncedTerm}”
            </p>
          ) : (
            <>
              <p role="status" className="visually-hidden">
                {results.length} {results.length === 1 ? "suggestion" : "suggestions"}
              </p>
              <ul aria-label="Search suggestions" className="search-suggestions__list">
                {results.slice(0, SUGGESTION_LIMIT).map((product) => (
                  <li key={product.id}>
                    <Link
                      to={`/products/${product.id}`}
                      className="search-suggestions__item"
                      onClick={() => setOpen(false)}
                    >
                      <span className="search-suggestions__title">{product.title}</span>
                      <span className="search-suggestions__meta">
                        {formatPrice(product.price)} · {product.category.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="search-suggestions__all"
                onClick={() => goToResults(debouncedTerm)}
              >
                See all {results.length} {results.length === 1 ? "result" : "results"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
