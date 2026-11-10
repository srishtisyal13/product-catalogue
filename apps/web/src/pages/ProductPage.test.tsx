import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/renderApp";
import { receivedEnquiries, server } from "../test/server";

describe("Product page", () => {
  it("opens the product details when a product tile is clicked", async () => {
    const { user } = renderApp("/");
    await user.click(await screen.findByRole("link", { name: /Portable SSD/ }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Portable SSD" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Portable SSD description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enquire" })).toBeInTheDocument();
  });

  it("shows a not found message for an unknown product", async () => {
    renderApp("/products/999");
    expect(await screen.findByText("We couldn't find that product.")).toBeInTheDocument();
  });
});

describe("Enquiry", () => {
  async function openEnquiryForm() {
    const result = renderApp("/products/2");
    await result.user.click(await screen.findByRole("button", { name: "Enquire" }));
    return result;
  }

  it("sends the enquiry and thanks the customer", async () => {
    const { user } = await openEnquiryForm();

    await user.type(screen.getByLabelText("Name"), "Asha Rao");
    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.type(screen.getByLabelText("Message"), "Do you have this in large?");
    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    expect(
      await screen.findByRole("heading", { name: "Thank you, Asha Rao!" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send enquiry" })).not.toBeInTheDocument();
    expect(receivedEnquiries).toEqual([
      expect.objectContaining({
        productId: "2",
        name: "Asha Rao",
        email: "asha@example.com",
        message: "Do you have this in large?",
      }),
    ]);
  });

  it("shows field errors and sends nothing when the form is invalid", async () => {
    const { user } = await openEnquiryForm();

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please fix the highlighted fields.");
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Please enter your name");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "Please enter a valid email address",
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(receivedEnquiries).toHaveLength(0);
  });

  it("keeps the form and shows the API's message when sending fails", async () => {
    server.use(
      http.post("*/api/enquiries", () =>
        HttpResponse.json(
          {
            error: {
              code: "ENQUIRY_NOT_SENT",
              message: "We couldn't send your enquiry right now.",
            },
          },
          { status: 503 },
        ),
      ),
    );
    const { user } = await openEnquiryForm();

    await user.type(screen.getByLabelText("Name"), "Asha Rao");
    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.type(screen.getByLabelText("Message"), "Hello");
    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't send your enquiry right now.",
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Send enquiry" })).toBeEnabled());
    expect(screen.getByLabelText("Name")).toHaveValue("Asha Rao");
  });
});
