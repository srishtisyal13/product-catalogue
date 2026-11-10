import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/renderApp";

describe("Category page", () => {
  it("shows top rated and additional products after clicking a category link", async () => {
    const { user } = renderApp("/");

    const nav = await screen.findByRole("navigation", { name: "Categories" });
    await user.click(within(nav).getByRole("link", { name: "electronics" }));

    const topRated = await screen.findByRole("list", { name: "Top rated in electronics" });
    expect(within(topRated).getAllByRole("link")).toHaveLength(2);

    const more = screen.getByRole("list", { name: "More in electronics" });
    expect(within(more).getByRole("link", { name: /Wireless Mouse/ })).toBeInTheDocument();
  });

  it("shows a not found message for an unknown category", async () => {
    renderApp("/categories/garden");
    expect(await screen.findByText("We couldn't find that category.")).toBeInTheDocument();
  });
});
