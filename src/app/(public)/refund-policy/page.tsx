import { MdxContent } from "@/components/public/mdx-content";

export const metadata = {
  title: "Refund Policy",
};

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <MdxContent fileName="refund-policy.mdx" />
    </div>
  );
}
