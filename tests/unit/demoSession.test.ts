import { expect, it, vi } from "vitest";
import { createDemoSignIn } from "../../host/demoSession";
it("ignores an older sign-in response when a newer role has already loaded", async () => {
  let resolveOld: (response: Response) => void = () => {};
  const request = vi
    .fn<typeof fetch>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "requestor-token" })),
    );
  const onToken = vi.fn(),
    signIn = createDemoSignIn(onToken, request);
  const older = signIn("engineer");
  await signIn("requestor");
  resolveOld(new Response(JSON.stringify({ token: "engineer-token" })));
  await older;
  expect(onToken).toHaveBeenCalledExactlyOnceWith("requestor-token", "/api");
});
it("ignores a late response from the previous data source", async () => {
  let resolveOld: (response: Response) => void = () => {};
  const request = vi
    .fn<typeof fetch>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "simulated-token" })),
    );
  const onToken = vi.fn(),
    signIn = createDemoSignIn(onToken, request);
  const older = signIn("engineer", "/api");
  await signIn("engineer", "/__simulated/api");
  resolveOld(new Response(JSON.stringify({ token: "api-token" })));
  await older;
  expect(request).toHaveBeenLastCalledWith(
    "/__simulated/api/demo/session",
    expect.anything(),
  );
  expect(onToken).toHaveBeenCalledExactlyOnceWith(
    "simulated-token",
    "/__simulated/api",
  );
});
