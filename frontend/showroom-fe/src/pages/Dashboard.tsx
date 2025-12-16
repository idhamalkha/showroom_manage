import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import { useAuth } from "../providers/AuthProvider";

const Dashboard = () => {
  const { user, logout } = useAuth();
  
  const { data: userData, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const r = await api.get("/auth/me");
      return r.data;
    },
    retry: false
  });

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 dashboard-page">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-semibold">
            Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm">
              {userData?.role || user?.role}
            </span>
            <button 
              onClick={logout}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors btn-logout"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Example Cards */}
        <div className="dashboard-card">
          <h3 className="text-lg font-medium mb-2">
            Total Users
          </h3>
          <p className="text-3xl font-bold">
            1,234
          </p>
        </div>

        <div className="dashboard-card">
          <h3 className="text-lg font-medium mb-2">
            Active Sessions
          </h3>
          <p className="text-3xl font-bold">
            56
          </p>
        </div>

        <div className="dashboard-card">
          <h3 className="text-lg font-medium mb-2">
            Revenue
          </h3>
          <p className="text-3xl font-bold">
            $12,345
          </p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;