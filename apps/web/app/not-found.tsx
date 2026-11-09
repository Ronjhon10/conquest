import Link from "next/link";
import { PageHeading } from "../src/components/ui";
export default function NotFound() {
  return (
    <div className="page-container">
      <PageHeading eyebrow="A small detour" title="This trail ends here">
        We couldn’t find that page. Your adventure is still waiting.
      </PageHeading>
      <Link className="cq-btn" href="/">
        Back to Conquest
      </Link>
    </div>
  );
}
