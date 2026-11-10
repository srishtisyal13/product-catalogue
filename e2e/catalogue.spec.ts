import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Each test drives the real web app in a browser and checks what it shows
 * against what the real API returns, so the frontend and backend are tested
 * together. Product data is live, so assertions compare with the API's answer
 * instead of hard-coding titles.
 */

const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";
const SALES_INBOX = process.env.E2E_SALES_INBOX ?? "sales@example.com";

type Product = {
  id: string;
  title: string;
  description: string;
  category: { slug: string; name: string };
};
type CategoryPage = { topRated: Product[]; others: Product[] };

async function apiGet<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(path);
  expect(response.ok(), `GET ${path} returned ${response.status()}`).toBe(true);
  return (await response.json()) as T;
}

test.describe("Home page", () => {
  test("shows the 5 chosen top rated products, in order", async ({ page, request }) => {
    const featured = await apiGet<Product[]>(request, "/api/products/featured");
    expect(featured).toHaveLength(5);

    await page.goto("/");

    const tiles = page.getByRole("list", { name: "Top rated products" }).getByRole("link");
    await expect(tiles).toHaveCount(5);
    for (const [index, product] of featured.entries()) {
      await expect(tiles.nth(index)).toContainText(product.title);
    }
  });
});

test.describe("Category page", () => {
  test("a category link shows top rated and additional products", async ({ page, request }) => {
    const expected = await apiGet<CategoryPage>(request, "/api/categories/electronics");
    expect(expected.topRated.length).toBeGreaterThan(0);
    expect(expected.others.length).toBeGreaterThan(0);

    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Categories" })
      .getByRole("link", { name: /electronics/i })
      .click();

    await expect(page).toHaveURL(/\/categories\/electronics$/);
    const topRated = page.getByRole("list", { name: "Top rated in electronics" });
    const more = page.getByRole("list", { name: "More in electronics" });
    await expect(topRated.getByRole("heading")).toHaveText(expected.topRated.map((p) => p.title));
    await expect(more.getByRole("heading")).toHaveText(expected.others.map((p) => p.title));
  });
});

test.describe("Search", () => {
  test("clicking Search shows only products matching the term", async ({ page, request }) => {
    const expected = await apiGet<Product[]>(request, "/api/products?search=jacket");
    expect(expected.length).toBeGreaterThan(0);
    for (const product of expected) {
      const text = `${product.title} ${product.description} ${product.category.name}`;
      expect(text.toLowerCase()).toContain("jacket");
    }

    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search products" }).fill("jacket");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page).toHaveURL(/\/search\?q=jacket$/);
    await expect(
      page.getByRole("list", { name: "Search results" }).getByRole("heading"),
    ).toHaveText(expected.map((p) => p.title));
  });

  test("a term with no matches shows the empty state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search products" }).fill("zzqqxx");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page.getByText("No products match “zzqqxx”")).toBeVisible();
  });
});

test.describe("Search suggestions while typing", () => {
  test("3+ characters show live suggestions; clicking one opens that product", async ({
    page,
    request,
  }) => {
    const expected = await apiGet<Product[]>(request, "/api/products?search=jacket");
    const first = expected[0];
    expect(first).toBeDefined();

    await page.goto("/");
    const searchBox = page.getByRole("searchbox", { name: "Search products" });

    // Two characters: no suggestions.
    await searchBox.pressSequentially("ja");
    await page.waitForTimeout(600);
    await expect(page.getByRole("list", { name: "Search suggestions" })).toHaveCount(0);

    // Six characters: suggestions from the API, at most 5.
    await searchBox.pressSequentially("cket");
    const suggestions = page.getByRole("list", { name: "Search suggestions" }).getByRole("link");
    await expect(suggestions).toHaveCount(Math.min(expected.length, 5));
    await expect(suggestions.first()).toContainText(first!.title);

    // Clicking a suggestion opens that product's page, not a search.
    await suggestions.first().click();
    await expect(page).toHaveURL(new RegExp(`/products/${first!.id}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(first!.title);
  });

  test("the Search button searches for exactly what is in the box", async ({ page }) => {
    await page.goto("/");
    const searchBox = page.getByRole("searchbox", { name: "Search products" });

    await searchBox.pressSequentially("jacket");
    await expect(page.getByRole("list", { name: "Search suggestions" })).toBeVisible();
    await searchBox.fill("backpack");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page).toHaveURL(/\/search\?q=backpack$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “backpack”");
  });
});

test.describe("Product page", () => {
  test("clicking a product tile opens its details page", async ({ page }) => {
    await page.goto("/");
    const firstTile = page
      .getByRole("list", { name: "Top rated products" })
      .getByRole("link")
      .first();
    const title = (await firstTile.getByRole("heading").textContent())?.trim() ?? "";
    expect(title).not.toBe("");

    await firstTile.click();

    await expect(page).toHaveURL(/\/products\/\w+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByRole("button", { name: "Enquire" })).toBeVisible();
  });

  test("an unknown product shows a not found message", async ({ page }) => {
    await page.goto("/products/999999");
    await expect(page.getByText("We couldn't find that product.")).toBeVisible();
  });
});

test.describe("Enquiry", () => {
  test("submitting the form emails the sales inbox and thanks the customer", async ({
    page,
    request,
  }) => {
    // A unique token lets us find exactly this email in the shared inbox.
    const token = `e2e${Date.now()}`;
    const customerEmail = `${token}@example.com`;

    await page.goto("/products/3");
    const productTitle = (await page.getByRole("heading", { level: 1 }).textContent())?.trim();
    await page.getByRole("button", { name: "Enquire" }).click();

    // Invalid input is caught before anything is sent.
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByText("Please fix the highlighted fields.")).toBeVisible();

    await page.getByLabel("Name").fill("E2E Tester");
    await page.getByLabel("Email").fill(customerEmail);
    await page.getByLabel("Message").fill(`Automated end-to-end check ${token}`);
    await page.getByRole("button", { name: "Send enquiry" }).click();

    await expect(page.getByRole("heading", { name: "Thank you, E2E Tester!" })).toBeVisible();

    const email = await waitForEmail(request, token);
    expect(email.Subject).toBe(`New enquiry: ${productTitle}`);
    expect(email.To.map((to) => to.Address)).toEqual([SALES_INBOX]);
    expect(email.ReplyTo.map((replyTo) => replyTo.Address)).toEqual([customerEmail]);

    const full = await apiGet<{ Text: string }>(
      request,
      `${MAILPIT_URL}/api/v1/message/${email.ID}`,
    );
    expect(full.Text).toContain("E2E Tester");
    expect(full.Text).toContain(`Automated end-to-end check ${token}`);
  });
});

type MailpitSummary = {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  ReplyTo: { Address: string }[];
};

/** Polls Mailpit's API until the email containing the token arrives. */
async function waitForEmail(request: APIRequestContext, token: string): Promise<MailpitSummary> {
  let found: MailpitSummary | undefined;
  await expect
    .poll(
      async () => {
        const body = await apiGet<{ messages: MailpitSummary[] }>(
          request,
          `${MAILPIT_URL}/api/v1/search?query=${token}`,
        );
        found = body.messages[0];
        return body.messages.length;
      },
      { message: "enquiry email to arrive in Mailpit", timeout: 10_000 },
    )
    .toBe(1);
  return found!;
}
