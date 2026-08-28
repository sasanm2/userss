import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

// the crypto pages are dark, so the placeholders are tinted to match
const LoadingCrypto = ({ rows = 10 }) => {
  return (
    <div>
      {Array(rows)
        .fill({})
        .map((row, index) => (
          <Skeleton
            key={index}
            className="mb-2"
            height={40}
            baseColor="#1a1f29"
            highlightColor="#232935"
          />
        ))}
    </div>
  );
};

export default LoadingCrypto;
