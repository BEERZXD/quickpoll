import { HostDashboard } from "./HostDashboard";
import { hostPageMetadata } from "@/lib/page-metadata";

type HostPageProps = {
  params: Promise<{ roomCode: string }>;
  searchParams: Promise<{ token?: string }>;
};

export async function generateMetadata({ params }: HostPageProps) {
  const { roomCode } = await params;
  return hostPageMetadata(roomCode);
}

export default async function HostPage({ params, searchParams }: HostPageProps) {
  const { roomCode } = await params;
  const { token = "" } = await searchParams;

  return <HostDashboard roomCode={roomCode} hostToken={token} />;
}
