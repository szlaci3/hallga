import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { App } from './App';
import { CreatePage } from './pages/CreatePage';
import { DataPage } from './pages/DataPage';
import { DocumentPage } from './pages/DocumentPage';
import { HomePage } from './pages/HomePage';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<HomePage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="new" element={<CreatePage />} />
          <Route path="document/:id" element={<DocumentPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
