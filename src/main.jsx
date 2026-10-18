import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout.jsx";
import { AuthProvider, Require, Entry } from "./lib/auth.jsx";
import Services from "./pages/Services.jsx";
import Process from "./pages/Process.jsx";
import Login from "./pages/Login.jsx";
import Account from "./pages/Account.jsx";
import { Portal, PortalProject } from "./pages/portal/Portal.jsx";
import Dashboard from "./pages/studio/Dashboard.jsx";
import StudioProject, { NewProject } from "./pages/studio/StudioProject.jsx";
import Compare, { Overheads } from "./pages/studio/Compare.jsx";
import Users from "./pages/studio/Users.jsx";
import PriceList from "./pages/studio/PriceList.jsx";
import Security from "./pages/Security.jsx";
import { ActivityPage } from "./pages/studio/Activity.jsx";

// Only /login is public. Everything else needs a signed-in user; /studio needs the admin.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Entry />} />
            <Route path="login" element={<Login />} />
            <Route path="account" element={<Require><Account /></Require>} />
            <Route path="security" element={<Require><Security /></Require>} />
            <Route path="studio/activity" element={<Require owner><ActivityPage /></Require>} />
            <Route path="services" element={<Require><Services /></Require>} />
            <Route path="process" element={<Require><Process /></Require>} />
            <Route path="portal" element={<Require><Portal /></Require>} />
            <Route path="portal/p/:slug" element={<Require><PortalProject /></Require>} />
            <Route path="studio" element={<Require owner><Dashboard /></Require>} />
            <Route path="studio/users" element={<Require owner><Users /></Require>} />
            <Route path="studio/pricing" element={<Require owner><PriceList /></Require>} />
            <Route path="studio/new" element={<Require owner><NewProject /></Require>} />
            <Route path="studio/compare" element={<Require owner><Compare /></Require>} />
            <Route path="studio/overheads" element={<Require owner><Overheads /></Require>} />
            <Route path="studio/p/:slug" element={<Require owner><StudioProject /></Require>} />
            <Route path="*" element={<Entry />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
