import { CachingProductRepository } from "./adapters/cache/cachingProductRepository.ts";
import { SmtpEmailSender } from "./adapters/email/smtpEmailSender.ts";
import { FakeStoreProductRepository } from "./adapters/fakestore/fakeStoreProductRepository.ts";
import type { Config } from "./config.ts";
import type { Logger, ProductRepository } from "./domain/ports.ts";
import { CatalogueService } from "./services/catalogueService.ts";
import { EnquiryService } from "./services/enquiryService.ts";

/**
 * Composition root: the only file that chooses concrete adapters. Changing
 * the data source or email provider means changing this file, not the services.
 */
export function buildServices(config: Config, logger: Logger) {
  const products: ProductRepository = new CachingProductRepository(
    new FakeStoreProductRepository({
      baseUrl: config.FAKESTORE_BASE_URL,
      timeoutMs: config.UPSTREAM_TIMEOUT_MS,
    }),
    { ttlMs: config.CACHE_TTL_SECONDS * 1000 },
  );

  const emailSender = new SmtpEmailSender({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  });

  return {
    catalogue: new CatalogueService({
      products,
      featuredProductIds: config.FEATURED_PRODUCT_IDS,
      topRatedPerCategory: config.TOP_RATED_PER_CATEGORY,
      logger,
    }),
    enquiries: new EnquiryService({
      products,
      emailSender,
      salesInboxEmail: config.SALES_INBOX_EMAIL,
      fromEmail: config.ENQUIRY_FROM_EMAIL,
      logger,
    }),
  };
}
