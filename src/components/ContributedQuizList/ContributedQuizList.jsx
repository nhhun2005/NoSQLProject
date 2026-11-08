import { useEffect, useState } from "react"; // Hook cơ bản
import { useSelector } from "react-redux"; // Lấy state user từ redux
import { useNavigate } from "react-router-dom"; // Chuyển trang
import ReactPaginate from "react-paginate"; // Pagination component
import contributedService from "../../services/contributedService"; // API service cho contributed quizzes

export default function ContributedQuizList() {
  const {
    account
  } = useSelector(state => state.user); // Lấy thông tin user hiện tại
  const navigate = useNavigate(); //Dùng để chuyển trang

  // State danh sách quizzes, loading
  const [quizzes, setQuizzes] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true); // Loading lần đầu
  const [pageLoading, setPageLoading] = useState(false); // Loading khi chuyển trang

  // State pagination
  const [currentPage, setCurrentPage] = useState(1); // Trang hiện tại
  const [pageCount, setPageCount] = useState(0); // Tổng số trang
  const itemsPerPage = 5;
  const [error, setError] = useState(""),
    [retry, setRetry] = useState(0); // Số items / page

  /**
   * Lấy danh sách quizzes có phân trang
   *  page - Trang hiện tại
   *  isPageChange - true nếu chỉ chuyển trang
   */
  const handlePageClick = event => setCurrentPage(event.selected + 1);
  useEffect(() => {
    let current = true;
    setInitialLoading(true);
    setPageLoading(currentPage > 1);
    setError('');
    contributedService.getPaginated({
      page: currentPage,
      limit: itemsPerPage
    }).then(res => {
      if (current) {
        setQuizzes(Array.isArray(res.data.data) ? res.data.data : []);
        setPageCount(res.data.pageCount || 0);
      }
    }).catch(() => {
      if (current) setError('Không thể tải danh sách đề đóng góp.');
    }).finally(() => {
      if (current) {
        setInitialLoading(false);
        setPageLoading(false);
      }
    });
    return () => {
      current = false;
    };
  }, [currentPage, account.id, retry]);
  if (error) return <div role="alert" className="p-8"><p>{error}</p><button type="button" onClick={() => setRetry(v => v + 1)}>Thử lại</button></div>;

  // Giao diện khi load trang lần đầu
  if (initialLoading) return <div className="text-center mt-10 text-lg text-green-700">
        Đang tải danh sách...
      </div>;
  return <div className="relative w-[95%] mx-auto my-4 bg-white rounded-xl shadow-md p-8">
      {/* Giao diện khi loading trang mới */}
      {pageLoading && <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center font-medium text-green-700 z-10 rounded-lg">
          Đang tải trang...
        </div>}

      <h2 className="text-2xl font-bold text-green-700 text-center mb-6">
        Danh sách đề người dùng đóng góp
      </h2>

      <table className="w-full border-collapse rounded-xl overflow-hidden bg-gray-50 shadow-sm">
        <thead>
          <tr className="bg-green-50 text-green-700 font-semibold">
            <th className="p-3 border-b border-gray-200">STT</th>
            <th className="p-3 border-b border-gray-200">Tên đề</th>
            <th className="p-3 border-b border-gray-200">Người đóng góp</th>
            <th className="p-3 border-b border-gray-200">Môn học</th>
            <th className="p-3 border-b border-gray-200">Chương</th>
            <th className="p-3 border-b border-gray-200">Ghi chú / Gợi ý</th>
            <th className="p-3 border-b border-gray-200">Trạng thái</th>
            <th className="p-3 border-b border-gray-200">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {quizzes.length > 0 ? quizzes.map((quiz, idx) => <tr key={quiz._id || idx} className={`text-center border-b border-gray-200 hover:bg-green-50 transition ${quiz.status === "rejected" ? "opacity-60" : ""}`}>
                {/* STT */}
                <td className="p-3">
                  {(currentPage - 1) * itemsPerPage + idx + 1}
                </td>
                {/* Tên đề */}
                <td className="p-3">{quiz.name || "—"}</td>
                {/* Người đóng góp */}
                <td className="p-3">
                  {quiz.contributorId?.username || "Ẩn danh"}
                </td>
                {/* Môn học */}
                <td className="p-3">
                  {quiz.subjectId ? quiz.subjectId.name : "Khác (chưa có trong hệ thống)"}
                </td>
                {/* Chương */}
                <td className="p-3">
                  {quiz.chapterId ? quiz.chapterId.name : quiz.subjectId ? "—" : "Chưa có chương"}
                </td>
                {/* Ghi chú / Gợi ý */}
                <td className="p-3">
                  {quiz.adminNote ? <div className="bg-green-50 text-gray-700 rounded-lg px-2 py-1 inline-block">
                      <span>{quiz.adminNote}</span>
                    </div> : "—"}
                </td>
                {/* Trạng thái duyệt */}
                <td className={`p-3 font-semibold ${quiz.status === "approved" ? "text-green-700" : quiz.status === "rejected" ? "text-red-600" : "text-yellow-600"}`}>
                  {quiz.status === "approved" ? "Đã duyệt" : quiz.status === "rejected" ? "Bị từ chối" : "Chờ duyệt"}
                </td>
                {/* Nút thao tác */}
                <td className="p-3">
                  {quiz.status === "pending" ? <button onClick={() => navigate(`/review-contributed/${quiz._id}`)} className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-1 transition font-medium">
                      Xem
                    </button> : <span className={`text-gray-400 ${quiz.status === "rejected" ? "opacity-70" : ""}`}>
                      — {/* Không có thao tác nếu đã duyệt / từ chối */}
                    </span>}
                </td>
              </tr>) :
        // Nếu không có dữ liệu
        <tr>
              <td colSpan={8} className="text-center py-6 text-gray-600">
                Không có dữ liệu
              </td>
            </tr>}
        </tbody>
      </table>

      {/* Pagination */}
      {pageCount > 1 && <div className="flex justify-center mt-6">
          <ReactPaginate onPageChange={handlePageClick} // callback khi bấm page
      pageRangeDisplayed={3} // số page hiện giữa
      marginPagesDisplayed={2} // số page đầu cuối
      pageCount={pageCount} // tổng số page
      containerClassName="flex gap-2 list-none" pageClassName="inline-block" pageLinkClassName="block px-3 py-1 border border-green-200 rounded-lg bg-white text-green-700 hover:bg-green-500 hover:text-white transition" previousLinkClassName="block px-3 py-1 border border-green-200 rounded-lg bg-white text-green-700 hover:bg-green-500 hover:text-white transition font-semibold" nextLinkClassName="block px-3 py-1 border border-green-200 rounded-lg bg-white text-green-700 hover:bg-green-500 hover:text-white transition font-semibold" breakLinkClassName="block px-3 py-1 text-green-700" activeLinkClassName="bg-green-700 text-green border-green-700" disabledLinkClassName="text-gray-400 bg-gray-100 border-gray-200 pointer-events-none" forcePage={currentPage - 1} // đồng bộ với state currentPage
      />
        </div>}
    </div>;
}
