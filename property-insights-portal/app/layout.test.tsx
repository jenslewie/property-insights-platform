import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import RootLayout, { metadata } from "./layout";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

test("renders the shared application shell around route content", () => {
  const document = new DOMParser().parseFromString(
    renderToStaticMarkup(
      <RootLayout>
        <h1>Route content</h1>
      </RootLayout>,
    ),
    "text/html",
  );

  expect(document.documentElement.lang).toBe("en");
  expect(
    document.querySelector('header a[href="/"]')?.textContent?.trim(),
  ).toBe("Property Insights");
  expect(
    document.querySelector('nav[aria-label="Primary navigation"]'),
  ).not.toBeNull();
  expect(document.querySelector("main h1")?.textContent).toBe("Route content");
});

test("exports the portal metadata", () => {
  expect(metadata).toEqual({
    title: {
      default: "Property Insights",
      template: "%s | Property Insights",
    },
    description: "Property valuation and market analysis portal",
  });
});
