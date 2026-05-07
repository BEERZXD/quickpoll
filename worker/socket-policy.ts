export type SocketRole = "host" | "voter";

export type ResultBroadcastRecipient = {
  role: SocketRole;
};

export function shouldReceiveResultBroadcast(recipient: ResultBroadcastRecipient): boolean {
  return recipient.role === "host";
}
