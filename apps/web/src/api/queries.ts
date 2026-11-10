import { keepPreviousData, QueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "./client";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        // Retry network and server errors, but not "not found" or "bad request".
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}

export const useFeaturedProducts = () =>
  useQuery({ queryKey: ["products", "featured"], queryFn: api.getFeatured });

export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: api.getCategories });

export const useCategoryPage = (slug: string) =>
  useQuery({ queryKey: ["categories", slug], queryFn: () => api.getCategoryPage(slug) });

export const useProductSearch = (term: string) =>
  useQuery({
    queryKey: ["products", "search", term],
    queryFn: ({ signal }) => api.searchProducts(term, signal),
    enabled: term.length > 0,
  });

/**
 * Live suggestions while typing. Uses the same query key as the search page,
 * so clicking Search after seeing suggestions reuses the cached result.
 * An outdated request is cancelled when the term changes.
 */
export const useSearchSuggestions = (term: string, enabled: boolean) =>
  useQuery({
    queryKey: ["products", "search", term],
    queryFn: ({ signal }) => api.searchProducts(term, signal),
    enabled,
    // Keep showing the last suggestions while the next ones load, to avoid flicker.
    placeholderData: keepPreviousData,
  });

export const useProduct = (id: string) =>
  useQuery({ queryKey: ["products", id], queryFn: () => api.getProduct(id) });

export const useSubmitEnquiry = () => useMutation({ mutationFn: api.submitEnquiry });
