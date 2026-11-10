import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/renderApp";
import { server } from "../test/server";
import { SUGGEST_DEBOUNCE_MS } from "./SearchBar";

/** Records every search term the app sends to the API. */
function recordSearches() {
  const terms: string[] = [];
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === "/api/products") terms.push(url.searchParams.get("search") ?? "");
  });
  return terms;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Search suggestions while typing", () => {
  it("does not call the API for fewer than 3 characters", async () => {
    const searches = recordSearches();
    const { user } = renderApp("/");

    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "ja");
    await wait(SUGGEST_DEBOUNCE_MS + 200);

    expect(searches).toEqual([]);
    expect(screen.queryByRole("list", { name: "Search suggestions" })).not.toBeInTheDocument();
    server.events.removeAllListeners();
  });

  it("shows matching products after 3 characters, with one request once typing pauses", async () => {
    const searches = recordSearches();
    const { user } = renderApp("/");

    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "jacket");

    const list = await screen.findByRole("list", { name: "Search suggestions" });
    const titles = within(list)
      .getAllByRole("link")
      .map((link) => link.querySelector(".search-suggestions__title")?.textContent);
    expect(titles).toEqual(["Mens Slim Fit Jacket", "Leather Jacket"]);
    // Typing quickly is debounced into a single request for the full term.
    expect(searches).toEqual(["jacket"]);
    server.events.removeAllListeners();
  });

  it("opens the product page when a suggestion is clicked", async () => {
    const { user } = renderApp("/");
    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "leather");

    const list = await screen.findByRole("list", { name: "Search suggestions" });
    await user.click(within(list).getByRole("link", { name: /Leather Jacket/ }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Leather Jacket" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Search suggestions" })).not.toBeInTheDocument();
  });

  it("'See all results' opens the full results page", async () => {
    const { user } = renderApp("/");
    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "jacket");

    await user.click(await screen.findByRole("button", { name: "See all 2 results" }));

    expect(await screen.findByRole("list", { name: "Search results" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Results for “jacket”");
  });

  it("tells the user when nothing matches", async () => {
    const { user } = renderApp("/");
    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "zzz");
    expect(await screen.findByText("No products match “zzz”")).toBeInTheDocument();
  });

  it("closes the suggestions on Escape", async () => {
    const { user } = renderApp("/");
    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "jacket");
    await screen.findByRole("list", { name: "Search suggestions" });

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("list", { name: "Search suggestions" })).not.toBeInTheDocument(),
    );
  });
});
