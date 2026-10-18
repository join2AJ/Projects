/* Client share build: the client pages only, opened on one project. No studio routes or private data. */
import React from "react";
import ReactDOM from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Services from "./pages/Services.jsx";
import Process from "./pages/Process.jsx";
import Request from "./pages/Request.jsx";
import Project from "./pages/Project.jsx";

const START = "/p/tailbone-treatment";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MemoryRouter initialEntries={[START]}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="services" element={<Services />} />
          <Route path="process" element={<Process />} />
          <Route path="request" element={<Request />} />
          <Route path="p/:slug" element={<Project />} />
          <Route path="*" element={<Project />} />
        </Route>
      </Routes>
    </MemoryRouter>
  </React.StrictMode>
);
