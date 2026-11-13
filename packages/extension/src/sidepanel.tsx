import React from 'react';
import { createRoot } from 'react-dom/client';
import { DrafterApp } from './components/DrafterApp.js';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <DrafterApp mode="sidepanel" />
);
