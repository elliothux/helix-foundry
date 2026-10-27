import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { BrandContext, BrandLink } from "../apps/web/src/brand.js";

const renderBrand = (name: string) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(
        BrandContext.Provider,
        { value: name },
        createElement(BrandLink),
      ),
    ),
  );

it("keeps the original wordmark and accessible name for an empty brand", () => {
  const html = renderBrand("");
  expect(html).toContain('aria-label="Helix Foundry home"');
  expect(html).toContain("helix<span>foundry</span>");
});

it("renders a custom brand as escaped text with the full accessible name", () => {
  const html = renderBrand("<b>澄岳能源</b>");
  expect(html).toContain("&lt;b&gt;澄岳能源&lt;/b&gt;");
  expect(html).not.toContain("<b>");
  expect(html).not.toContain("Helix Foundry home");
});
