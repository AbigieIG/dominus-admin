import { useState, useEffect, use } from "react";
import {
  Outlet,
  useNavigate,
  useLocation,
  type LoaderFunction,
  redirect,
} from "react-router";
import {
  Home,
  Users,
  Settings,
  MessageCircle,
  LogOut,
  Menu,
  MailIcon,
  X,
  User,
  Bell,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { requireAdminSession } from "./utils/admin.server";
import settings from '~/assets/settings.json';


export const loader: LoaderFunction = async ({ request }) => {
  try {
    return await requireAdminSession(request);
  } catch (error) {
    throw redirect("/");
  }
};

const logout = async () => {
  await fetch("/api/logout", { method: "POST" });
};

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<{ name: string; email: string }>();





  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/get-data");
        const result = await response.json();
        setData(result.data);
      } catch (err) {
       console.log(err)
      } 
    }
    fetchData();
  }, [])



  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Handle sidebar collapse state based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        // setIsCollapsed(true);
        setSidebarOpen(false);
      } else {
        setIsCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const navigationItems = [
    { name: "Dashboard", icon: Home, path: "/admin" },
    { name: "Create", icon: Users, path: "/admin/create" },
    { name: "Chat", icon: MessageCircle, path: "/chats" },
    { name: "Email", icon: MailIcon, path: "/admin/send-mails" },
    { name: "Otp Code", icon: ShieldCheck, path: "/admin/otp" },
    { name: "Settings", icon: Settings, path: "/admin/settings" },
  ];

 
  return (
    <div className="flex min-h-screen lg:h-screen  bg-gray-100">
      {/* Transparent Sidebar Overlay for mobile - only for closing sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "w-20" : "w-64"}`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-300">
            {!isCollapsed && (
              <h1 className="text-xl font-bold text-blue-600">{data?.name || "Admin Panel"}</h1>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-md hover:bg-gray-100 hidden lg:block"
            >
              {isCollapsed ? (
                <ChevronRight size={20} />
              ) : (
                <ChevronLeft size={20} />
              )}
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-md hover:bg-gray-100 lg:hidden"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation items */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center w-full p-3 rounded-lg text-left transition-colors ${
                    isActive
                      ? "bg-blue-100 text-blue-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={20} />
                  {!isCollapsed && <span className="ml-3">{item.name}</span>}
                </button>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-300">
            <div
              className={`flex items-center ${isCollapsed ? "justify-center" : ""}`}
            >
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                  <User size={20} className="text-white" />
                </div>
              </div>
              {!isCollapsed && (
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    {data?.name || "Admin"}
                  </p>
                  <p className="text-xs text-gray-500">{data?.email || "Administrator"}</p>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <button
                onClick={logout}
                className="flex items-center w-full p-2 mt-4 text-sm text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <LogOut size={16} className="mr-2" />
                Sign out
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm z-10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 mr-2 text-gray-700 rounded-md hover:bg-gray-100 lg:hidden"
              >
                <Menu size={20} />
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                {navigationItems.find((item) => item.path === location.pathname)
                  ?.name || "Dashboard"}
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-700 rounded-full hover:bg-gray-100 relative">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button className="p-2 text-gray-700 rounded-full hover:bg-gray-100">
                <HelpCircle size={20} />
              </button>
              <div className="hidden md:flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center mr-2">
                  <User size={16} className="text-white" />
                </div>
                {/* <span className="text-sm font-medium">Admin User</span> */}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-white hidden border-t border-gray-300 py-4 px-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm text-gray-600 text-center md:text-left mb-4 md:mb-0">
              © {new Date().getFullYear()} Admin Panel. All rights reserved.
            </p>
            <div className="flex items-center space-x-6">
              <a href="#" className="text-sm text-gray-600 hover:text-gray-900">
                Privacy Policy
              </a>
              <a href="#" className="text-sm text-gray-600 hover:text-gray-900">
                Terms of Service
              </a>
              <a href="#" className="text-sm text-gray-600 hover:text-gray-900">
                Contact
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
