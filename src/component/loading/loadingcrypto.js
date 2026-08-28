import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

const LoadingCrypto = ({ rows = 10 }) => {
  return (
    <div>
      {Array(rows)
        .fill({})
        .map((row, index) => (
          <Skeleton key={index} className="mb-2" height={40} />
        ))}
    </div>
  );
};

export default LoadingCrypto;
