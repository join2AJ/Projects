import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Services from "./pages/Services.jsx";
import Process from "./pages/Process.jsx";
import Request from "./pages/Request.jsx";
import Project from "./pages/Project.jsx";
import Studio, { StudioProject } from "./pages/Studio.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="services" element={<Services />} />
          <Route path="process" element={<Process />} />
          <Route path="request" element={<Request />} />
          <Route path="p/:slug" element={<Project />} />
          <Route path="studio" element={<Studio />} />
          <Route path="studio/p/:slug" element={<StudioProject />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
