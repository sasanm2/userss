import { useState } from "react";
import { walkForward, verdict } from "./walkforward";
import { BUY } from "./signals";

/* Shows how the readings fared when they were only allowed to see the past.
 *
 * The table above this one is in sample: every signal is scored on the same
 * bars it was spotted on, which is why it nearly always looks good. This one
 * splits the history into blocks, picks the rule from the bars before each
 * block, and scores it on the block itself. The gap between the two is the
 * point of the whole panel.
 */
const toneClass = (tone) =>
  tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-muted";

const edgeClass = (edge) => (edge > 2 ? "text-success" : edge < -2 ? "text-danger" : "text-muted");

const points = (value) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

const WalkForwardPanel = ({ closes = [], candles = [], volumes = [], horizon = 7, pointLabel = "points" }) => {
  const [showRules, setShowRules] = useState(false);

  const result = walkForward({ closes, candles, volumes }, { horizon, count: 4 });
  const read = verdict(result.summary);
  const summary = result.summary;

  const kept =
    summary && summary.meanTrainEdge !== 0
      ? (summary.meanTestEdge / summary.meanTrainEdge) * 100
      : null;

  return (
    <div className="mt-4">
      <h4>does any of it hold out of sample</h4>

      <p className="text-muted mb-2">
        <small>
          The table above scores every signal on the same {pointLabel} it was spotted on, which
          flatters it. Here the history is cut into four blocks: the rule is taken from the{" "}
          {pointLabel} before each block and scored only on the block itself, with a gap at every
          boundary so no training outcome reaches across it.
        </small>
      </p>

      {!summary ? (
        <p className="text-muted">{read.detail}</p>
      ) : (
        <>
          <div className="row text-center mb-3">
            <div className="col-6 col-md-3">
              <small className="text-muted d-block">rules tested forward</small>
              <strong>{summary.tested}</strong>
            </div>
            <div className="col-6 col-md-3">
              <small className="text-muted d-block">direction held</small>
              <strong className={summary.heldRate > 60 ? "text-success" : summary.heldRate < 45 ? "text-danger" : ""}>
                {summary.heldRate.toFixed(0)}%
              </strong>
              <small className="text-muted d-block">chance is 50%</small>
            </div>
            <div className="col-6 col-md-3">
              <small className="text-muted d-block">edge in sample</small>
              <strong>{points(summary.meanTrainEdge)}</strong>
            </div>
            <div className="col-6 col-md-3">
              <small className="text-muted d-block">same rules, out of sample</small>
              <strong className={edgeClass(summary.meanTestEdge)}>{points(summary.meanTestEdge)}</strong>
              {kept !== null && (
                <small className="text-muted d-block">{Math.round(kept)}% of it kept</small>
              )}
            </div>
          </div>

          <div className="text-center my-3">
            <div className={`h5 mb-1 ${toneClass(read.tone)}`}>{read.text}</div>
            <small className="text-muted">{read.detail}</small>
          </div>

          <button
            onClick={() => setShowRules(!showRules)}
            className="btn btn-sm btn-outline-info mb-2"
          >
            {showRules ? "hide the individual tests" : `show all ${result.rows.length} tests`}
          </button>

          {showRules && (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>rule taken from the past</th>
                    <th className="text-end">block</th>
                    <th className="text-end">before</th>
                    <th className="text-end">after</th>
                    <th className="text-end">edge in</th>
                    <th className="text-end">edge out</th>
                    <th className="text-end">held</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={`${row.label}-${row.fold}`}>
                      <td>
                        {row.label}{" "}
                        <span className={row.signal === BUY ? "text-success" : "text-danger"}>
                          {row.signal}
                        </span>
                      </td>
                      <td className="text-end">{row.fold}</td>
                      <td className="text-end">{row.trainCount}</td>
                      <td className="text-end">{row.testCount}</td>
                      <td className="text-end">{points(row.trainEdge)}</td>
                      {/* left uncoloured on purpose: for a bearish rule a
                          negative edge here means it was right, so a red would
                          read as a failure when the held column says it worked */}
                      <td className="text-end">{points(row.testEdge)}</td>
                      <td className="text-end">
                        {!row.decisive ? (
                          <span className="text-muted">too small</span>
                        ) : row.held ? (
                          <span className="text-success">yes</span>
                        ) : (
                          <span className="text-danger">no</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WalkForwardPanel;
