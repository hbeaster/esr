/** Publish only the newest demo sign-in when role changes overlap in flight. */
export function createDemoSignIn(
  onToken: (token: string) => void,
  request: typeof fetch = fetch,
) {
  let sequence = 0;
  return async (userId: string): Promise<void> => {
    const requestId = ++sequence;
    const response = await request("/api/demo/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) throw new Error("Unable to acquire a demo session.");
    const session: { token: string } = await response.json();
    if (requestId === sequence) onToken(session.token);
  };
}
