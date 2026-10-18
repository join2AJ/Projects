import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout.jsx";
import { AuthProvider, Require } from "./lib/auth.jsx";
import Home from "./pages/Home.jsx";
import Services from "./pages/Services.jsx";
import Process from "./pages/Process.jsx";
import Request from "./pages/Request.jsx";
import Login from "./pages/Login.jsx";
import { Portal, PortalProject } from "./pages/portal/Portal.jsx";
import Dashboard from "./pages/studio/Dashboard.jsx";
import StudioProject, { NewProject } from "./pages/studio/StudioProject.jsx";
import Compare, { Overheads } from "./pages/studio/Compare.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="services" element={<Services />} />
            <Route path="process" element={<Process />} />
            <Route path="request" element={<Request />} />
            <Route path="login" element={<Login />} />
            <Route path="portal" element={<Require><Portal /></Require>} />
            <Route path="portal/p/:slug" element={<Require><PortalProject /></Require>} />
            <Route path="studio" element={<Require owner><Dashboard /></Require>} />
            <Route path="studio/new" element={<Require owner><NewProject /></Require>} />
            <Route path="studio/compare" element={<Require owner><Compare /></Require>} />
            <Route path="studio/overheads" element={<Require owner><Overheads /></Require>} />
            <Route path="studio/p/:slug" element={<Require owner><StudioProject /></Require>} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
