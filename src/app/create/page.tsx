import { HomeClient } from "../HomeClient";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata();

export default function CreatePage() {
  return <HomeClient initialMode="create" />;
}
