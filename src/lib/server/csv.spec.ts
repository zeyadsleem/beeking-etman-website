import { describe, expect, it } from "vite-plus/test";
import { csvCell } from "./csv";

describe("csvCell", () => {
  it("passes plain values through", () => {
    expect(csvCell("HNY-123456")).toBe("HNY-123456");
  });

  it("neutralises formula-leading cells", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+201234567890")).toBe("'+201234567890");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("quotes cells containing separators, quotes, or newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });

  it("neutralises and quotes in one pass", () => {
    expect(csvCell('=cmd|"x",y')).toBe('"\'=cmd|""x"",y"');
  });
});
