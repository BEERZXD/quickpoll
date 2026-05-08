import { VoteClient } from "./VoteClient";
import { voterPageMetadata } from "@/lib/page-metadata";

type PollPageProps = {
  params: Promise<{ roomCode: string }>;
};

export async function generateMetadata({ params }: PollPageProps) {
  const { roomCode } = await params;
  return voterPageMetadata(roomCode);
}

export default async function PollPage({ params }: PollPageProps) {
  const { roomCode } = await params;
  return <VoteClient roomCode={roomCode} />;
}
