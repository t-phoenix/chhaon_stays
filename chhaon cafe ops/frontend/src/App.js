import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";

import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import Orders from "@/pages/Orders";
import NewOrder from "@/pages/NewOrder";
import OrderDetail from "@/pages/OrderDetail";
import EditOrder from "@/pages/EditOrder";
import Menu from "@/pages/Menu";
import Kitchen from "@/pages/Kitchen";
import Dashboard from "@/pages/Dashboard";
import Supply from "@/pages/Supply";
import Users from "@/pages/Users";
import MeshJoin from "@/pages/MeshJoin";
import GuestBill from "@/pages/GuestBill";

const Protected = ({ children, admin = false }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-paper">
        <div className="font-display text-3xl text-sage animate-pulse">brewing your view…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/orders" replace />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/" element={<Navigate to="/orders" replace />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/guests/:mobile" element={<GuestBill />} />
            <Route path="/orders/new" element={<NewOrder />} />
            <Route path="/orders/:id/edit" element={<EditOrder />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/kitchen" element={<Kitchen />} />
            <Route path="/supply" element={<Supply />} />
            <Route path="/mesh/join" element={<MeshJoin />} />
            <Route
              path="/menu"
              element={
                <Protected admin>
                  <Menu />
                </Protected>
              }
            />
            <Route
              path="/dashboard"
              element={
                <Protected admin>
                  <Dashboard />
                </Protected>
              }
            />
            <Route
              path="/users"
              element={
                <Protected admin>
                  <Users />
                </Protected>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/orders" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}

export default App;
