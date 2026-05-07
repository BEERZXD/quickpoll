import { HostDashboard } from "./HostDashboard";

type HostPageProps = {
  params: Promise<{ roomCode: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function HostPage({ params, searchParams }: HostPageProps) {
  const { roomCode } = await params;
  const { token = "" } = await searchParams;

  return <HostDashboard roomCode={roomCode} hostToken={token} />;
}

