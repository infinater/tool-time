import { useTimer } from "./timerStore";

/** 超过 90 分钟的专注，开始前确认一次 */
export default function StartConfirmDialog() {
  const pending = useTimer((s) => s.pendingConfirm);
  const confirmStart = useTimer((s) => s.confirmStart);
  const cancelStart = useTimer((s) => s.cancelStart);
  const setWorkMinutes = useTimer((s) => s.setWorkMinutes);

  if (!pending) return null;

  const { minutes } = pending;

  return (
    <div className="backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6 backdrop-blur-[2px]">
      <div
        className="dialog-in w-full max-w-[380px] rounded-[18px] p-6"
        style={{ background: "var(--c-surface)", boxShadow: "var(--shadow-pop)" }}
      >
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-strong">这次 {minutes} 分钟，算两个番茄？</h3>
        <p className="mt-2 text-[12.5px] leading-relaxed text-sub">
          一个番茄通常 25 分钟。单次超过 90 分钟容易记成一段，回看时分不清中间发生了什么——但记录里仍然只算 1 个番茄。
        </p>

        <div className="mt-6 flex items-center justify-between">
          <button className="btn-ghost px-2 py-1 text-[12.5px]" onClick={cancelStart}>
            取消
          </button>
          <div className="flex gap-2">
            <button
              className="btn-soft"
              onClick={() => {
                setWorkMinutes(45);
                cancelStart();
              }}
            >
              改成 45 分钟
            </button>
            <button className="btn-primary" onClick={confirmStart}>
              就按 {minutes} 分钟开始
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
