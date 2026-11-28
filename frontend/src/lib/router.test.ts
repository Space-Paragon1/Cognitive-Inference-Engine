import { describe, expect, it } from "vitest";
import { href, mobileTab, parentRoute } from "./router";

describe("href", () => {
  it("builds hash routes", () => {
    expect(href("now")).toBe("#/now");
    expect(href("settings", "sources")).toBe("#/settings/sources");
  });
});

describe("parentRoute", () => {
  it("has no parents on wide layouts", () => {
    expect(parentRoute("settings", false, "privacy")).toBeNull();
  });
  it("goes from Settings to More, and from Privacy to Settings", () => {
    expect(parentRoute("settings", true)).toEqual({ route: "more", sub: null });
    expect(parentRoute("settings", true, "privacy")).toEqual({ route: "settings", sub: null });
  });
  it("climbs the History pages one level at a time", () => {
    expect(parentRoute("history", true, "1732560000/log")).toEqual({ route: "history", sub: "1732560000" });
    expect(parentRoute("history", true, "1732560000")).toEqual({ route: "history", sub: null });
    expect(parentRoute("history", true)).toBeNull();
  });
  it("leaves the tabs themselves without a parent", () => {
    expect(parentRoute("tasks", true)).toBeNull();
  });
});

describe("mobileTab", () => {
  it("lights the tab a page sits under", () => {
    expect(mobileTab("history")).toBe("insights");
    expect(mobileTab("settings")).toBe("more");
    expect(mobileTab("focus")).toBe("focus");
  });
});
