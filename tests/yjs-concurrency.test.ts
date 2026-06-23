import { describe, expect, it } from "vitest";
import * as Y from "yjs";

function connect(source: Y.Doc, target: Y.Doc) {
  Y.applyUpdate(target, Y.encodeStateAsUpdate(source));
}

describe("Yjs concurrency", () => {
  it("converges after independent inserts are exchanged", () => {
    const left = new Y.Doc();
    const right = new Y.Doc();
    const leftText = left.getText("content");
    const rightText = right.getText("content");

    leftText.insert(0, "hello");
    connect(left, right);

    leftText.insert(5, " from owner");
    rightText.insert(5, " from reviewer");

    connect(left, right);
    connect(right, left);

    expect(leftText.toString()).toBe(rightText.toString());
    expect(leftText.toString()).toContain("owner");
    expect(leftText.toString()).toContain("reviewer");
  });

  it("keeps repeated update application idempotent", () => {
    const origin = new Y.Doc();
    const replica = new Y.Doc();
    origin.getText("content").insert(0, "stable snapshot");

    const update = Y.encodeStateAsUpdate(origin);
    Y.applyUpdate(replica, update);
    Y.applyUpdate(replica, update);

    expect(replica.getText("content").toString()).toBe("stable snapshot");
  });
});
