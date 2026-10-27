import { createContext, useContext } from "react";
import { Link } from "react-router-dom";

export const DEFAULT_BRAND = "Helix Foundry";
export const BrandContext = createContext("");
export const useBrand = () => useContext(BrandContext) || DEFAULT_BRAND;

export function BrandLink() {
  const brand = useBrand();
  return (
    <Link
      to="/"
      className="hf-brand"
      aria-label={`${brand} home`}
      title={brand}
    >
      <span className="hf-brand-name">
        {brand === DEFAULT_BRAND ? (
          <>
            helix<span>foundry</span>
          </>
        ) : (
          brand
        )}
      </span>
    </Link>
  );
}
