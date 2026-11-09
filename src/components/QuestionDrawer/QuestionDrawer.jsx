import { useState } from 'react';
import { ChevronUp, ChevronDown, Flag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function QuestionDrawer({
  totalQuestions = 50,
  answered = [],
  flagged = [],
  currentQuestion = 1,
  onSelectQuestion,
  onSubmit,
  onRetry,
  onStop,
  remainingTime = '1:30:00',
  showRetryButton = false,
  submitDisabled = false,
  retryDisabled = false,
  rotationalPractice = false,
}) {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  return (
    <div className={`fixed bottom-0 left-0 w-full bg-white border-t border-gray-300 shadow-2xl z-50 transition-all duration-300 ease-in-out ${open ? 'h-[28vh] min-h-[240px] max-[600px]:h-[42vh] max-[600px]:min-h-[280px]' : 'h-0'}`}>
      <button
        type="button"
        aria-label={open ? 'Thu gọn bảng câu hỏi' : 'Mở bảng câu hỏi'}
        aria-expanded={open}
        aria-controls="question-drawer-panel"
        onClick={() => setOpen(previous => !previous)}
        className="absolute top-[-40px] right-5 bg-gray-200 hover:bg-gray-300 border border-gray-400 rounded-t-lg p-2 shadow-md"
      >
        {open ? <ChevronDown size={22} /> : <ChevronUp size={22} />}
      </button>

      {open && (
        <div id="question-drawer-panel" aria-label="Bảng điều khiển bài làm" className="flex justify-between items-start h-full overflow-y-auto p-5 lg:p-6 max-[600px]:flex-col max-[600px]:p-4">
          <div className="flex-1 min-w-0 pr-5 max-[600px]:w-full max-[600px]:pr-0 max-[600px]:mb-4">
            <div className="max-h-[18vh] overflow-y-auto pr-1 max-[600px]:max-h-[16vh]">
              <div className="grid grid-cols-10 gap-3 justify-items-center w-full max-w-2xl mx-auto max-[800px]:grid-cols-8 max-[600px]:grid-cols-7 max-[400px]:grid-cols-6 max-[600px]:gap-2">
                {Array.from({ length: totalQuestions }, (_, i) => {
                  const number = i + 1;
                  const isAnswered = answered.includes(number);
                  const isFlagged = flagged.includes(number);
                  const isCurrent = currentQuestion === number;
                  return (
                    <div key={number} className="relative">
                      {isFlagged && <Flag size={12} aria-hidden="true" className="absolute top-[-7px] right-[-7px] text-yellow-700" />}
                      <button
                        type="button"
                        aria-label={`Chuyển đến câu ${number}${isAnswered ? ', đã trả lời' : ''}${isFlagged ? ', đã đánh dấu' : ''}`}
                        aria-current={isCurrent ? 'step' : undefined}
                        onClick={() => onSelectQuestion(number)}
                        className={`w-10 h-10 text-sm font-medium flex items-center justify-center rounded-md border-[1.5px] transition-colors max-[600px]:w-9 max-[600px]:h-9 ${isFlagged ? 'bg-yellow-100 border-yellow-500' : isAnswered ? 'bg-green-100 border-green-600' : 'bg-white border-gray-400'} ${isCurrent ? 'outline outline-2 outline-[#3D763A] border-[#3D763A] text-[#3D763A]' : 'hover:bg-green-50'}`}
                      >
                        {number}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 min-w-[220px] shrink-0 max-[600px]:w-full max-[600px]:min-w-0 max-[600px]:grid-cols-2">
            <div className="text-center max-[600px]:col-span-2 max-[600px]:flex max-[600px]:justify-between max-[600px]:items-center">
              <p className="text-xl font-medium text-gray-700 mb-1 max-[600px]:mb-0 max-[600px]:text-base">Thời gian</p>
              <p className="text-[#3D763A] text-3xl leading-tight font-bold mb-0 max-[600px]:text-2xl">{remainingTime}</p>
            </div>
            {rotationalPractice ? (
              <button type="button" onClick={onStop || (() => navigate(-1))} className="app-button w-full max-[600px]:text-sm">
                Dừng ôn tập
              </button>
            ) : (
              <button type="button" disabled={submitDisabled} onClick={onSubmit} className="app-button w-full max-[600px]:text-sm">
                Nộp bài
              </button>
            )}
            {showRetryButton && (
              <button type="button" disabled={retryDisabled} onClick={onRetry} className="app-button app-button--secondary w-full max-[600px]:text-sm">
                Làm lại câu sai
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
