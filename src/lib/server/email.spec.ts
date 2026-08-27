import { describe, expect, it, vi } from "vite-plus/test";
import { sendEmail } from "./email";

describe("sendEmail", () => {
  it("is a no-op when the EMAIL binding is absent", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // No platform at all — should not throw.
    await sendEmail(undefined, {
      to: "test@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("EMAIL binding unavailable"),
      "test@example.com",
    );
    warn.mockRestore();
  });

  it("is a no-op when platform exists but EMAIL is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Platform with no EMAIL binding — exercises the platform?.env.EMAIL path.
    await sendEmail({ env: {} } as unknown as App.Platform, {
      to: "test@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("calls env.EMAIL.send when binding is available", async () => {
    const sendMock = vi.fn().mockResolvedValue({ messageId: "msg-123" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const platform = { env: { EMAIL: { send: sendMock } } } as unknown as App.Platform;

    await sendEmail(platform, {
      to: "user@test.com",
      subject: "Test",
      html: "<p>Body</p>",
      text: "Body",
    });

    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@test.com",
        subject: "Test",
        html: "<p>Body</p>",
        text: "Body",
      }),
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
