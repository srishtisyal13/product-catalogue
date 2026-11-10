import { Link } from "react-router";

export function NotFoundPage({ message = "We couldn't find that page." }: { message?: string }) {
  return (
    <>
      <title>Not found | Product Catalogue</title>
      <h1>Not found</h1>
      <p className="lead">{message}</p>
      <Link to="/" className="button">
        Back to top rated products
      </Link>
    </>
  );
}
