type AdminMessageProps = {
  message: string | null;
};

export function AdminMessage({ message }: AdminMessageProps) {
  if (!message) return null;

  const className =
    message.includes("updated") || message.includes("started") ? "success" : "error";

  return <p className={className}>{message}</p>;
}
