import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { featured } from "../test/fixtures";
import { renderApp } from "../test/renderApp";
import { server } from "../test/server";

describe("Home page", () => {
  it("shows the 5 chosen top rated products in order", async () => {
    renderApp("/");

    const grid = await screen.findByRole("list", { name: "Top rated products" });
    const tiles = within(grid).getAllByRole("link");
    expect(tiles).toHaveLength(5);
    tiles.forEach((tile, index) => expect(tile).toHaveTextContent(featured[index]!.title));
  });

  it("links each tile to its product page", async () => {
    renderApp("/");
    const tile = await screen.findByRole("link", { name: /Portable SSD/ });
    expect(tile).toHaveAttribute("href", "/products/4");
  });

  it("shows the API's message and a retry button when loading fails", async () => {
    server.use(
      http.get("*/api/products/featured", () =>
        HttpResponse.json(
          {
            error: {
              code: "UPSTREAM_UNAVAILABLE",
              message: "Products are temporarily unavailable.",
            },
          },
          { status: 502 },
        ),
      ),
    );
    renderApp("/");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Products are temporarily unavailable.");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
