"use client";

// Phế Liệu Thiên Nhung public home entry; presentation lives in PublicHome.

import { useEffect, useState } from "react";
import { adminApi, authApi, publicApi, type AuthUser, type Customer, type Material, type PurchaseOrder } from "../api/client";
import AdminShell from "../components/home/AdminShell";
import CustomerPortal from "../components/home/CustomerPortal";
import LoginModal from "../components/home/LoginModal";
import PublicHome from "../components/home/PublicHome";
import { ADMIN_TABS } from "../components/home/homeData";
import "../components/home/home.css";

export default function Home() {
  const [view, setView] = useState<"public" | "admin">("public");
  const [tab, setTab] = useState("Tổng quan");
  const [kg, setKg] = useState(10);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [publicMaterials, setPublicMaterials] = useState<Material[]>([]);
  const [selectedMatName, setSelectedMatName] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showLogin, setShowLogin] = useState(false);
  const [authError, setAuthError] = useState("");
  const [customerUser, setCustomerUser] = useState<AuthUser | null>(null);
  const [adminStats, setAdminStats] = useState<Record<string, any>>({});
  const [recentOrders, setRecentOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("adminTab");
    if (requestedTab && ADMIN_TABS.includes(requestedTab as (typeof ADMIN_TABS)[number])) {
      setTab(requestedTab);
    }
  }, []);

  const loadPublicData = async () => {
    try {
      const data = await publicApi.prices();
      // An empty response is valid: the admin may have hidden every material.
      setPublicMaterials(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn("Public API error, falling back to mock data:", error);
    }
  };

  useEffect(() => {
    void loadPublicData();
  }, []);

  useEffect(() => {
    if (!selectedMatName && materials.length > 0) {
      setSelectedMatName(materials[0].name);
    }
  }, [materials, selectedMatName]);

  useEffect(() => {
    authApi.me()
      .then((response) => {
        if (!response.user) return;
        if (response.user.role === "admin") {
          setView("admin");
        } else {
          setCustomerUser(response.user);
        }
      })
      .catch(() => {
        // stay public when not logged in
      });
  }, []);

  useEffect(() => {
    if (view !== "admin") return;
    void loadAdminData();
  }, [view]);

  const loadAdminData = async () => {
    try {
      const [custData, summaryData, ordersData, inventoryData, materialData] = await Promise.all([
        adminApi.customers(),
        adminApi.summary(),
        adminApi.orders(),
        adminApi.inventory().catch(() => ({ items: [] })),
        adminApi.materials(),
      ]);

      setCustomers(Array.isArray(custData) ? custData : (custData as any)?.items || []);
      setAdminStats(summaryData);
      setRecentOrders(Array.isArray(ordersData) ? ordersData : (ordersData as any)?.items || []);
      setMaterials(Array.isArray(materialData) ? materialData : []);

      const invItems = Array.isArray(inventoryData) ? inventoryData : (inventoryData as any)?.items || [];
      if (invItems.length > 0) {
        setMaterials((current) =>
          current.map((item) => {
            const matched = (invItems as any[]).find((entry) => entry.id === item.id || entry.name === item.name);
            return matched ? { ...item, qty_kg: matched.qty_kg, warning_kg: matched.warning_kg } : item;
          }),
        );
      }
    } catch (error) {
      console.warn("Admin API error, keeping current/fallback data:", error);
    }
  };

  const logout = async () => {
    await authApi.logout();
    await loadPublicData();
    setCustomerUser(null);
    setView("public");
  };

  const openPublic = async () => {
    await loadPublicData();
    setView("public");
  };

  if (customerUser) {
    return <CustomerPortal user={customerUser} onLogout={logout} />;
  }

  if (showLogin) {
    return (
      <LoginModal
        onClose={() => setShowLogin(false)}
        onSuccess={(user) => {
          if (user.role === "admin") {
            setView("admin");
          } else {
            setCustomerUser(user);
          }
          setShowLogin(false);
        }}
        error={authError}
      />
    );
  }

  if (view === "admin") {
    return (
      <AdminShell
        tab={tab}
        setTab={setTab}
        stats={adminStats}
        customers={customers}
        setCustomers={setCustomers}
        recentOrders={recentOrders}
        materials={materials}
        reloadAdmin={loadAdminData}
        onPublic={openPublic}
        onLogout={logout}
      />
    );
  }

  return (
    <PublicHome
      materials={publicMaterials}
      selectedMatName={selectedMatName}
      setSelectedMatName={setSelectedMatName}
      kg={kg}
      setKg={setKg}
      onOpenLogin={() => {
        setAuthError("");
        setShowLogin(true);
      }}
    />
  );
}
