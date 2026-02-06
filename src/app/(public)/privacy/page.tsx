import { MdxContent } from "@/components/public/mdx-content";

export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <MdxContent fileName="privacy.mdx" />
    </div>
  );
}
