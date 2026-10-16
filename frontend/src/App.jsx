// src/App.jsx
import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { TelemetryProvider } from "./context/TelemetryContext";
import PublicHomePage from "./pages/PublicHomePage";
import AuthPage from "./pages/AuthPage";
import HomeDashboard from "./pages/HomeDashboard";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AboutDashboard from "./pages/AboutDashboard";

function AppRouter() {
  const { currentUser, userRole } = useAuth();
  const [authView, setAuthView] = useState("landing");
  const [internalView, setInternalView] = useState("home");

  if (!currentUser) {
    if (authView === "auth") {
      return <AuthPage onBackToHome={() => setAuthView("landing")} />;
    }
    return <PublicHomePage onNavigateToAuth={() => setAuthView("auth")} />;
  }

  return (
    <TelemetryProvider key={currentUser.uid}>
      {userRole === "admin" ? (
        internalView === "about" ? (
          <AboutDashboard 
            onBackToHome={() => setInternalView("home")} 
            onOpenConsole={() => setInternalView("fleet")} 
          />
        ) : (
          <AdminDashboard 
            initialSubView={internalView === "fleet" ? "fleet" : "home"}
            onBackToHome={() => setInternalView("home")} 
            onOpenAbout={() => setInternalView("about")} 
          />
        )
      ) : (
        internalView === "about" ? (
          <AboutDashboard 
            onBackToHome={() => setInternalView("home")} 
            onOpenConsole={() => setInternalView("console")} 
          />
        ) : internalView === "console" ? (
          <UserDashboard 
            onBackToHome={() => setInternalView("home")} 
            onOpenAbout={() => setInternalView("about")} 
          />
        ) : (
          <HomeDashboard 
            onOpenConsole={() => setInternalView("console")} 
            onOpenAbout={() => setInternalView("about")} 
          />
        )
      )}
    </TelemetryProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}