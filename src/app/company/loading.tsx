import { BrandLoader } from "@/components/brand/logo";

export default function Loading() {
  return (
    <div aria-busy="true" className="grid min-h-[50vh] place-items-center">
      <BrandLoader />
    </div>
  );
}
