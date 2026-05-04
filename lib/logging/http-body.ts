const MAX_LOG_BODY_BYTES = 2048;

export async function readBodySafely(res: Response): Promise<string | undefined> {
  try {
    if (res.bodyUsed) return undefined;
    const text = await res.text();
    return text.length > MAX_LOG_BODY_BYTES
      ? text.slice(0, MAX_LOG_BODY_BYTES) + '…[truncated]'
      : text;
  } catch {
    return '<unreadable>';
  }
}
