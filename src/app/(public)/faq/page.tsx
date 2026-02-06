import { MdxContent } from "@/components/public/mdx-content";

export const metadata = {
  title: "FAQ",
  description: "Frequently asked questions about our digital goods marketplace.",
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <MdxContent fileName="faq.mdx" />
    </div>
  );
}
