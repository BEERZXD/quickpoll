import { VoteClient } from "./VoteClient";

type PollPageProps = {
  params: Promise<{ roomCode: string }>;
};

export default async function PollPage({ params }: PollPageProps) {
  const { roomCode } = await params;
  return <VoteClient roomCode={roomCode} />;
}

