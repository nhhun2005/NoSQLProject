// src/pages/AdminPage/AdminPage.jsx
import SidebarAdmin from "../../components/Users/SidebarAdmin";
import NavbarAdmin from "../../components/Users/NavbarAdmin";
import UserTable from "../../components/Users/UserTable";
import { useEffect, useState } from "react";
// import api from "../../api/axiosInstance"; // axios đã có token
import userService from "../../services/userService"; // Xài thằng này thay cho API cũ
import { useSelector } from "react-redux";
function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const account = useSelector(state => state.user.account);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    userService.getAll().then(({
      data
    }) => {
      if (current) setUsers(data);
    }).catch(() => {
      if (current) setError('Không tải được danh sách tài khoản.');
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [retry]);
  return <div className="flex h-screen bg-gray-50">
      <SidebarAdmin />

      <div className="flex flex-col flex-1">
        <NavbarAdmin username={account?.username || "Admin"} />

        <section className="flex-1 p-6">
          {loading ? <p role="status">Đang tải tài khoản...</p> : error ? <div role="alert"><p>{error}</p><button type="button" className="app-button" onClick={() => setRetry(v => v + 1)}>Thử lại</button></div> : <><UserTable users={users} setUsers={setUsers} />{!users.length && <p>Chưa có tài khoản để hiển thị.</p>}</>}
        </section>
      </div>
    </div>;
}
export default AdminDashboard;
