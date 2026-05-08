import { VoteClient } from "./VoteClient";
import { fetchVoterPageMetadata } from "@/lib/page-metadata";

type PollPageProps = {
  params: Promise<{ roomCode: string }>;
};

export async function generateMetadata({ params }: PollPageProps) {
  const { roomCode } = await params;
  return fetchVoterPageMetadata(roomCode);
}

export default async function PollPage({ params }: PollPageProps) {
  const { roomCode } = await params;
  return <VoteClient roomCode={roomCode} />;
}
