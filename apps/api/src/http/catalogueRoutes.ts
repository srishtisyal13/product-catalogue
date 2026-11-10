import { SEARCH_TERM_MAX_LENGTH } from "@catalogue/shared";
import express from "express";
import { z } from "zod";
import { NotFoundError } from "../domain/errors.ts";
import type { CatalogueService } from "../services/catalogueService.ts";
import { parseOrThrow } from "./validation.ts";

const searchQuerySchema = z.object({
  search: z
    .string({ error: "Enter a search term" })
    .trim()
    .min(1, "Enter a search term")
    .max(
      SEARCH_TERM_MAX_LENGTH,
      `Search term must be ${SEARCH_TERM_MAX_LENGTH} characters or fewer`,
    ),
});

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

export function catalogueRoutes(catalogue: CatalogueService): express.Router {
  const router = express.Router();

  router.get("/categories", async (_req, res) => {
    res.json(await catalogue.listCategories());
  });

  router.get("/categories/:slug", async (req, res) => {
    const { slug } = req.params;
    if (!SLUG_PATTERN.test(slug)) throw new NotFoundError(`Category "${slug}" not found`);
    res.json(await catalogue.getCategoryPage(slug));
  });

  // Registered before /products/:id so "featured" isn't read as an ID.
  router.get("/products/featured", async (_req, res) => {
    res.json(await catalogue.getFeatured());
  });

  router.get("/products", async (req, res) => {
    const { search } = parseOrThrow(searchQuerySchema, req.query);
    res.json(await catalogue.search(search));
  });

  router.get("/products/:id", async (req, res) => {
    const { id } = req.params;
    if (!ID_PATTERN.test(id)) throw new NotFoundError(`Product "${id}" not found`);
    res.json(await catalogue.getProduct(id));
  });

  return router;
}
