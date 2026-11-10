import { useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError } from "../api/client";
import { useProduct } from "../api/queries";
import { EnquiryForm } from "../components/EnquiryForm";
import { Rating } from "../components/Rating";
import { ErrorMessage, Loading } from "../components/Status";
import { formatPrice } from "../format";
import { NotFoundPage } from "./NotFoundPage";

type EnquiryState = { step: "closed" } | { step: "open" } | { step: "sent"; name: string };

export function ProductPage() {
  const { id = "" } = useParams();
  const { data: product, error, isPending, refetch } = useProduct(id);
  const [enquiry, setEnquiry] = useState<EnquiryState>({ step: "closed" });

  if (isPending) return <Loading label="Loading product…" />;
  if (error instanceof ApiError && error.isNotFound) {
    return <NotFoundPage message="We couldn't find that product." />;
  }
  if (error) return <ErrorMessage error={error} onRetry={() => void refetch()} />;

  return (
    <article className="product-detail">
      <title>{`${product.title} | Product Catalogue`}</title>
      <div className="product-detail__image">
        <img src={product.imageUrl} alt={product.title} />
      </div>

      <div className="product-detail__info">
        <Link to={`/categories/${product.category.slug}`} className="product-detail__category">
          {product.category.name}
        </Link>
        <h1>{product.title}</h1>
        <p className="product-detail__price">{formatPrice(product.price)}</p>
        <Rating rating={product.rating} />
        <p className="product-detail__description">{product.description}</p>

        {enquiry.step === "closed" && (
          <button type="button" className="button" onClick={() => setEnquiry({ step: "open" })}>
            Enquire
          </button>
        )}
        {enquiry.step === "open" && (
          <EnquiryForm
            product={product}
            onSent={(name) => setEnquiry({ step: "sent", name })}
            onCancel={() => setEnquiry({ step: "closed" })}
          />
        )}
        {enquiry.step === "sent" && (
          <div role="status" className="thank-you">
            <h2>Thank you, {enquiry.name}!</h2>
            <p>
              We've received your enquiry about {product.title}. Our sales team will be in touch by
              email soon.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
