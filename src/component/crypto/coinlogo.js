import { useState, useEffect } from "react";

// the api gives us a logo url for every coin, but it can be missing or fail to
// load, so we fall back to a circle with the first letters of the symbol
const CoinLogo = ({ src, symbol = "", name = "", size = 24 }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <span
        className="coin-logo-fallback"
        title={name}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {symbol.slice(0, 3).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className="coin-logo"
      onError={() => setFailed(true)}
    />
  );
};

export default CoinLogo;
