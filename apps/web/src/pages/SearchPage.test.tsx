import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/renderApp";
import { server } from "../test/server";

describe("Search", () => {
  it("shows only matching products after clicking Search", async () => {
    const { user } = renderApp("/");
    const searchedFor: string[] = [];
    server.events.on("request:start", ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === "/api/products") searchedFor.push(url.searchParams.get("search") ?? "");
    });

    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "  jacket ");
    await user.click(screen.getByRole("button", { name: "Search" }));

    const results = await screen.findByRole("list", { name: "Search results" });
    const titles = within(results)
      .getAllByRole("heading")
      .map((heading) => heading.textContent);
    expect(titles).toEqual(["Mens Slim Fit Jacket", "Leather Jacket"]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Results for “jacket”");
    expect(searchedFor).toEqual(["jacket"]);
    server.events.removeAllListeners();
  });

  it("does not search for a blank term", async () => {
    const { user } = renderApp("/");
    await screen.findByRole("list", { name: "Top rated products" });

    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "   ");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Top rated products");
  });

  it("tells the user when nothing matches", async () => {
    renderApp("/search?q=zzz");
    expect(await screen.findByText(/No products match “zzz”/)).toBeInTheDocument();
  });

  it("asks for a term when the URL has none", () => {
    renderApp("/search");
    expect(screen.getByText("Enter a search term to find products.")).toBeInTheDocument();
  });

  it("shows an error message when search fails", async () => {
    server.use(http.get("*/api/products", () => HttpResponse.error()));
    renderApp("/search?q=jacket");
    expect(await screen.findByRole("alert")).toHaveTextContent("can't reach the server");
  });
});
